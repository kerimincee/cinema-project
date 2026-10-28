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

// Örnek 1x1 PNG binary verisi (Base64) - yerel yedek veritabanı başlangıç BLOB verisi için
const DEFAULT_POSTER_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Eğer geliştirici bilgisayarında XAMPP / MySQL açık değilse devreye giren yerel yedek (fallback) veritabanı
export interface LocalDBUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  student_number?: string;
  department?: string;
  password_hash: string;
  role: string;
  created_at?: string;
}

interface LocalDBData {
  users: Array<LocalDBUser>;
  screenings: Array<{
    id: number;
    movie_title: string;
    description: string;
    trailer_url: string;
    cover_image: string; // Base64 encoded binary BLOB
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
        phone: '05550000000',
        student_number: 'ADM001',
        department: 'Bilgi İşlem',
        password_hash: '$2b$10$8LgsGOehaHT5Te/JCT8FDuOnAsFtafr6evpY/5N5LvltC1LqW/DhK',
        role: 'admin',
        created_at: new Date().toISOString(),
      },
    ],
    screenings: [
      {
        id: 1,
        movie_title: 'Inception',
        description: 'Bir hırsızın rüyalar üzerinden bilinçaltına sızarak fikir çalma hikayesi.',
        trailer_url: 'https://www.youtube.com/watch?v=YoHD9XEInc0',
        cover_image: DEFAULT_POSTER_BASE64,
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
        { Field: 'cover_image' },
        { Field: 'screening_date' },
        { Field: 'screening_time' },
        { Field: 'total_capacity' },
      ],
      [],
    ];
  }

  // SHOW COLUMNS FROM users
  if (upperSql.startsWith('SHOW COLUMNS FROM USERS')) {
    return [
      [
        { Field: 'id' },
        { Field: 'name' },
        { Field: 'email' },
        { Field: 'phone' },
        { Field: 'student_number' },
        { Field: 'department' },
        { Field: 'password_hash' },
        { Field: 'role' },
        { Field: 'created_at' },
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
    let name = '';
    let email = '';
    let phone = '';
    let student_number = '';
    let department = '';
    let password_hash = '';
    let role = 'user';

    const colMatch = sql.match(/INSERT\s+INTO\s+users\s*\(([^)]+)\)/i);
    if (colMatch) {
      const cols = colMatch[1].split(',').map((c) => c.trim().toLowerCase());
      cols.forEach((col, idx) => {
        const val = params[idx];
        if (col === 'name') name = String(val ?? '');
        else if (col === 'email') email = String(val ?? '');
        else if (col === 'phone') phone = String(val ?? '');
        else if (col === 'student_number') student_number = String(val ?? '');
        else if (col === 'department') department = String(val ?? '');
        else if (col === 'password_hash') password_hash = String(val ?? '');
        else if (col === 'role') role = String(val ?? 'user');
      });
    } else {
      [name, email, password_hash, role] = params.map((p) => String(p ?? ''));
    }

    const newUser: LocalDBUser = {
      id: nextId,
      name,
      email,
      phone,
      student_number,
      department,
      password_hash,
      role: role || 'user',
      created_at: new Date().toISOString(),
    };

    db.users.push(newUser);
    saveLocalDB(db);
    return [{ insertId: nextId, affectedRows: 1 }, []];
  }

  // SCREENINGS: SELECT by id
  if (upperSql.includes('FROM SCREENINGS WHERE ID = ?')) {
    const id = Number(params[0]);
    const rows = db.screenings
      .filter((s) => s.id === id)
      .map((s) => ({
        ...s,
        cover_image: Buffer.from(s.cover_image || DEFAULT_POSTER_BASE64, 'base64'),
      }));
    return [rows, []];
  }

  // SCREENINGS: SELECT latest
  if (upperSql.includes('FROM SCREENINGS ORDER BY ID DESC LIMIT 1')) {
    const sorted = [...db.screenings].sort((a, b) => b.id - a.id);
    const rows = sorted.slice(0, 1).map((s) => ({
      ...s,
      cover_image: Buffer.from(s.cover_image || DEFAULT_POSTER_BASE64, 'base64'),
    }));
    return [rows, []];
  }

  // SCREENINGS: INSERT
  if (upperSql.startsWith('INSERT INTO SCREENINGS')) {
    const colMatch = normalizedSql.match(/INSERT INTO screenings \(([^)]+)\)/i);
    const cols = colMatch ? colMatch[1].split(',').map((c) => c.trim()) : [];
    const nextId = db.screenings.reduce((max, s) => Math.max(max, s.id), 0) + 1;
    const newRow: Record<string, unknown> = { id: nextId };
    cols.forEach((col, idx) => {
      const val = params[idx];
      newRow[col] = Buffer.isBuffer(val) ? val.toString('base64') : val;
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
          ? val.toString('base64')
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
        user_phone: u?.phone || '',
        user_student_number: u?.student_number || '',
        user_department: u?.department || '',
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
    } else if (upperSql.includes('WHERE ID = ?')) {
      const id = Number(params[0]);
      db.reservations.forEach((r) => {
        if (r.id === id && r.status === 'active') {
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

  // RESERVATIONS: DELETE ALL (Reset)
  if (upperSql.startsWith('DELETE FROM RESERVATIONS')) {
    const count = db.reservations.length;
    db.reservations = [];
    saveLocalDB(db);
    return [{ affectedRows: count }, []];
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
 * DATABASE.md'de belirtildiği gibi screenings tablosunda cover_image (LONGBLOB) sütununun
 * bulunduğundan emin olur.
 */
export async function ensureCoverImageBlobColumn(): Promise<void> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>('SHOW COLUMNS FROM screenings');
    const cols = new Set(rows.map((r) => r.Field as string));

    if (!cols.has('cover_image') && cols.has('cover_image_url')) {
      await pool.query(
        'ALTER TABLE screenings CHANGE COLUMN cover_image_url cover_image LONGBLOB NOT NULL'
      );
    } else if (!cols.has('cover_image')) {
      await pool.query('ALTER TABLE screenings ADD COLUMN cover_image LONGBLOB NOT NULL');
    }
  } catch {
    // Yetki veya tablo hatası varsa yoksay
  }
}

/**
 * DATABASE.md'de belirtildiği gibi users tablosunda phone, student_number, department sütunlarının
 * bulunduğundan emin olur. Eksikse otomatik olarak ekler.
 */
export async function ensureUserColumns(): Promise<void> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>('SHOW COLUMNS FROM users');
    const cols = new Set(rows.map((r) => r.Field as string));

    if (!cols.has('phone')) {
      await pool.query('ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL AFTER email');
    }
    if (!cols.has('student_number')) {
      await pool.query('ALTER TABLE users ADD COLUMN student_number VARCHAR(50) DEFAULT NULL AFTER phone');
    }
    if (!cols.has('department')) {
      await pool.query('ALTER TABLE users ADD COLUMN department VARCHAR(100) DEFAULT NULL AFTER student_number');
    }
    if (!cols.has('created_at')) {
      await pool.query('ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    }
  } catch {
    // Yetki veya tablo hatası varsa yoksay
  }
}

/**
 * Binary BLOB verisinin MIME türünü tespit eder.
 */
export function detectImageMimeType(buf: Buffer): string {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return 'image/gif';
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

/**
 * Veritabanından gelen screening satırındaki BLOB (cover_image) verisini
 * frontend'de doğrudan görüntülenebilecek Base64 Data URI formatına dönüştürür.
 */
export function normalizeScreeningRow(row: Record<string, unknown>, activeReservations = 0) {
  let coverImageBase64 = '';

  const rawBlob = row.cover_image;
  if (Buffer.isBuffer(rawBlob) && rawBlob.length > 0) {
    const mimeType = detectImageMimeType(rawBlob);
    coverImageBase64 = `data:${mimeType};base64,${rawBlob.toString('base64')}`;
  } else if (typeof rawBlob === 'string' && rawBlob.trim() !== '') {
    coverImageBase64 = rawBlob.startsWith('data:')
      ? rawBlob
      : `data:image/jpeg;base64,${rawBlob}`;
  }

  const totalCapacity = Number(row.total_capacity) || 0;
  const reservedCount = Number(activeReservations) || 0;
  const remainingCapacity = Math.max(0, totalCapacity - reservedCount);

  return {
    id: row.id,
    movie_title: row.movie_title,
    description: row.description,
    trailer_url: row.trailer_url,
    cover_image: coverImageBase64,
    screening_date: row.screening_date,
    screening_time: row.screening_time,
    total_capacity: totalCapacity,
    active_reservations: reservedCount,
    remaining_capacity: remainingCapacity,
    is_full: remainingCapacity <= 0,
  };
}
