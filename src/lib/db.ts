import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

// Veritabanı bağlantı havuzu (MySQL / MariaDB - XAMPP)
const mysqlPool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cinema_reservation',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  connectTimeout: 2000,
});

// Eğer geliştirici bilgisayarında XAMPP / MySQL açık değilse devreye giren yerel yedek (fallback) veritabanı
interface LocalDBData {
  users: Array<{
    id: number;
    name: string;
    email: string;
    password_hash: string;
    role: string;
  }>;
  screenings: Array<{
    id: number;
    movie_title: string;
    description: string;
    trailer_url: string;
    cover_image_url: string;
    cover_image?: string;
    screening_date: string;
    screening_time: string;
    total_capacity: number;
  }>;
  reservations: Array<{
    id: number;
    user_id: number;
    screening_id: number;
    status: string;
    created_at: string;
  }>;
}

const LOCAL_DB_PATH = path.join(process.cwd(), '.next', 'local-cinema-db.json');

function loadLocalDB(): LocalDBData {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf-8'));
    }
  } catch {
    // ignore read error
  }
  return {
    users: [
      {
        id: 1,
        name: 'Sistem Yöneticisi (Admin)',
        email: 'admin@cinema.com',
        password_hash: 'admin123',
        role: 'admin',
      },
    ],
    screenings: [
      {
        id: 1,
        movie_title: 'Inception',
        description: 'Bir hırsızın rüyalar üzerinden bilinçaltına sızarak fikir çalma hikayesi.',
        trailer_url: 'https://www.youtube.com/watch?v=YoHD9XEInc0',
        cover_image_url: 'https://m.media-amazon.com/images/I/81p+xe8cbnL._AC_SY679_.jpg',
        cover_image: 'https://m.media-amazon.com/images/I/81p+xe8cbnL._AC_SY679_.jpg',
        screening_date: '2026-10-25',
        screening_time: '20:30:00',
        total_capacity: 50,
      },
    ],
    reservations: [],
  };
}

function saveLocalDB(data: LocalDBData) {
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // ignore write error
  }
}

function executeLocalQuery(sql: string, params: unknown[] = []): [unknown, unknown] {
  const db = loadLocalDB();
  const normalizedSql = sql.replace(/\s+/g, ' ').trim();
  const upperSql = normalizedSql.toUpperCase();

  // SHOW COLUMNS FROM screenings
  if (upperSql.startsWith('SHOW COLUMNS FROM SCREENINGS')) {
    return [
      [
        { Field: 'id' },
        { Field: 'movie_title' },
        { Field: 'description' },
        { Field: 'trailer_url' },
        { Field: 'cover_image_url' },
        { Field: 'cover_image' },
        { Field: 'screening_date' },
        { Field: 'screening_time' },
        { Field: 'total_capacity' },
      ],
      [],
    ];
  }

  // ALTER TABLE
  if (upperSql.startsWith('ALTER TABLE')) {
    return [{ affectedRows: 0 }, []];
  }

  // USERS: SELECT by email
  if (upperSql.includes('FROM USERS WHERE EMAIL = ?')) {
    const email = String(params[0] ?? '').toLowerCase();
    const rows = db.users.filter((u) => u.email.toLowerCase() === email);
    return [rows, []];
  }

  // USERS: SELECT by id
  if (upperSql.includes('FROM USERS WHERE ID = ?')) {
    const id = Number(params[0]);
    const rows = db.users.filter((u) => u.id === id);
    return [rows, []];
  }

  // USERS: INSERT
  if (upperSql.startsWith('INSERT INTO USERS')) {
    const nextId = db.users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
    const [name, email, password_hash, role] = params;
    db.users.push({
      id: nextId,
      name: String(name),
      email: String(email),
      password_hash: String(password_hash),
      role: String(role || 'user'),
    });
    saveLocalDB(db);
    return [{ insertId: nextId, affectedRows: 1 }, []];
  }

  // SCREENINGS: SELECT by id
  if (upperSql.includes('FROM SCREENINGS WHERE ID = ?')) {
    const id = Number(params[0]);
    const rows = db.screenings.filter((s) => s.id === id);
    return [rows, []];
  }

  // SCREENINGS: SELECT latest
  if (upperSql.includes('FROM SCREENINGS ORDER BY ID DESC LIMIT 1')) {
    const sorted = [...db.screenings].sort((a, b) => b.id - a.id);
    return [sorted.slice(0, 1), []];
  }

  // SCREENINGS: INSERT
  if (upperSql.startsWith('INSERT INTO SCREENINGS')) {
    const colMatch = normalizedSql.match(/INSERT INTO screenings \(([^)]+)\)/i);
    const cols = colMatch ? colMatch[1].split(',').map((c) => c.trim()) : [];
    const nextId = db.screenings.reduce((max, s) => Math.max(max, s.id), 0) + 1;
    const newRow: Record<string, unknown> = { id: nextId };
    cols.forEach((col, idx) => {
      const val = params[idx];
      newRow[col] = Buffer.isBuffer(val) ? val.toString('utf-8') : val;
    });
    db.screenings.push(newRow as LocalDBData['screenings'][0]);
    saveLocalDB(db);
    return [{ insertId: nextId, affectedRows: 1 }, []];
  }

  // SCREENINGS: UPDATE
  if (upperSql.startsWith('UPDATE SCREENINGS SET')) {
    const setPart = normalizedSql.slice(
      normalizedSql.toUpperCase().indexOf('SET ') + 4,
      normalizedSql.toUpperCase().lastIndexOf(' WHERE ID = ?')
    );
    const assignments = setPart.split(',').map((s) => s.split('=')[0].trim());
    const targetId = Number(params[params.length - 1]);
    const target = db.screenings.find((s) => s.id === targetId);
    if (target) {
      assignments.forEach((col, idx) => {
        const val = params[idx];
        (target as Record<string, unknown>)[col] = Buffer.isBuffer(val)
          ? val.toString('utf-8')
          : val;
      });
      saveLocalDB(db);
      return [{ affectedRows: 1 }, []];
    }
    return [{ affectedRows: 0 }, []];
  }

  // RESERVATIONS: COUNT active for screening
  if (upperSql.includes('SELECT COUNT(*) AS COUNT FROM RESERVATIONS WHERE SCREENING_ID = ?')) {
    const screeningId = Number(params[0]);
    const count = db.reservations.filter(
      (r) => r.screening_id === screeningId && r.status === 'active'
    ).length;
    return [[{ count }], []];
  }

  // RESERVATIONS: Check existing active reservation for user & screening
  if (
    upperSql.includes('FROM RESERVATIONS WHERE SCREENING_ID = ? AND USER_ID = ?') ||
    upperSql.includes('FROM RESERVATIONS WHERE USER_ID = ? AND SCREENING_ID = ?')
  ) {
    const firstIsScreening = upperSql.indexOf('SCREENING_ID') < upperSql.indexOf('USER_ID');
    const screeningId = Number(firstIsScreening ? params[0] : params[1]);
    const userId = Number(firstIsScreening ? params[1] : params[0]);
    const rows = db.reservations.filter(
      (r) => r.screening_id === screeningId && r.user_id === userId && r.status === 'active'
    );
    return [rows, []];
  }

  // RESERVATIONS: INSERT
  if (upperSql.startsWith('INSERT INTO RESERVATIONS')) {
    const nextId = db.reservations.reduce((max, r) => Math.max(max, r.id), 0) + 1;
    const [user_id, screening_id] = params;
    db.reservations.push({
      id: nextId,
      user_id: Number(user_id),
      screening_id: Number(screening_id),
      status: 'active',
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    saveLocalDB(db);
    return [{ insertId: nextId, affectedRows: 1 }, []];
  }

  // RESERVATIONS: SELECT list with JOIN
  if (upperSql.includes('FROM RESERVATIONS R')) {
    let list = db.reservations.map((r) => {
      const u = db.users.find((user) => user.id === r.user_id);
      const s = db.screenings.find((sc) => sc.id === r.screening_id);
      return {
        id: r.id,
        user_id: r.user_id,
        user_name: u?.name || '',
        user_email: u?.email || '',
        screening_id: r.screening_id,
        movie_title: s?.movie_title || '',
        screening_date: s?.screening_date || '',
        screening_time: s?.screening_time || '',
        status: r.status,
        created_at: r.created_at,
      };
    });
    if (upperSql.includes('WHERE R.USER_ID = ?')) {
      const userId = Number(params[0]);
      list = list.filter((item) => item.user_id === userId);
    }
    return [list.reverse(), []];
  }

  // RESERVATIONS: UPDATE status = 'cancelled'
  if (upperSql.startsWith("UPDATE RESERVATIONS SET STATUS = 'CANCELLED'")) {
    let affected = 0;
    if (upperSql.includes('WHERE ID = ? AND USER_ID = ?')) {
      const [id, userId] = params.map(Number);
      db.reservations.forEach((r) => {
        if (r.id === id && r.user_id === userId && r.status === 'active') {
          r.status = 'cancelled';
          affected++;
        }
      });
    } else if (upperSql.includes('WHERE SCREENING_ID = ? AND USER_ID = ?')) {
      const [screeningId, userId] = params.map(Number);
      db.reservations.forEach((r) => {
        if (r.screening_id === screeningId && r.user_id === userId && r.status === 'active') {
          r.status = 'cancelled';
          affected++;
        }
      });
    } else if (upperSql.includes('WHERE USER_ID = ?')) {
      const userId = Number(params[0]);
      db.reservations.forEach((r) => {
        if (r.user_id === userId && r.status === 'active') {
          r.status = 'cancelled';
          affected++;
        }
      });
    }
    if (affected > 0) saveLocalDB(db);
    return [{ affectedRows: affected }, []];
  }

  return [[], []];
}

function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'ER_BAD_DB_ERROR'
  );
}

const pool = {
  async query<T = mysql.RowDataPacket[]>(sql: string, values?: unknown[]): Promise<[T, mysql.FieldPacket[]]> {
    try {
      return await mysqlPool.query<T & mysql.RowDataPacket[]>(sql, values);
    } catch (err) {
      if (isConnectionError(err)) {
        return executeLocalQuery(sql, values) as [T, mysql.FieldPacket[]];
      }
      throw err;
    }
  },
  async getConnection(): Promise<mysql.PoolConnection> {
    try {
      return await mysqlPool.getConnection();
    } catch (err) {
      if (isConnectionError(err)) {
        return {
          query: async (sql: string, values?: unknown[]) => executeLocalQuery(sql, values),
          beginTransaction: async () => {},
          commit: async () => {},
          rollback: async () => {},
          release: () => {},
        } as unknown as mysql.PoolConnection;
      }
      throw err;
    }
  },
};

export default pool;

/**
 * screenings tablosundaki mevcut sütunları kontrol eder.
 * Hem cover_image_url (VARCHAR) hem de cover_image (LONGBLOB/TEXT) sütunlarını destekler.
 */
export async function getScreeningsColumns(
  connection?: Pick<mysql.PoolConnection, 'query'>
): Promise<Set<string>> {
  const executor = connection || pool;
  const [rows] = await executor.query<mysql.RowDataPacket[]>(
    `SHOW COLUMNS FROM screenings`
  );
  return new Set(rows.map((r) => r.Field as string));
}

/**
 * Veritabanından gelen screening satırını hem cover_image_url hem de cover_image
 * alanlarını içerecek şekilde normalize eder.
 */
export function normalizeScreeningRow(row: Record<string, unknown>, activeReservations = 0) {
  let imageValue = '';

  if (typeof row.cover_image_url === 'string' && row.cover_image_url.trim() !== '') {
    imageValue = row.cover_image_url;
  } else if (row.cover_image) {
    if (Buffer.isBuffer(row.cover_image)) {
      const str = row.cover_image.toString('utf-8');
      if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:') || str.startsWith('/')) {
        imageValue = str;
      } else {
        imageValue = `data:image/jpeg;base64,${row.cover_image.toString('base64')}`;
      }
    } else if (typeof row.cover_image === 'string') {
      imageValue = row.cover_image;
    }
  }

  const totalCapacity = Number(row.total_capacity) || 0;
  const reservedCount = Number(activeReservations) || 0;
  const remainingCapacity = Math.max(0, totalCapacity - reservedCount);

  return {
    id: row.id,
    movie_title: row.movie_title,
    description: row.description,
    trailer_url: row.trailer_url,
    cover_image_url: imageValue,
    cover_image: imageValue,
    screening_date: row.screening_date,
    screening_time: row.screening_time,
    total_capacity: totalCapacity,
    active_reservations: reservedCount,
    remaining_capacity: remainingCapacity,
    is_full: remainingCapacity <= 0,
  };
}
