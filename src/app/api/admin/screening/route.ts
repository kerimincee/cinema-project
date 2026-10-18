import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import pool, { getScreeningsColumns, normalizeScreeningRow } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

interface ParsedScreeningInput {
  id?: number;
  user_id?: number | string;
  movie_title?: string;
  description?: string;
  trailer_url?: string;
  cover_image_url?: string;
  cover_imageBuffer?: Buffer;
  screening_date?: string;
  screening_time?: string;
  total_capacity?: number;
}

/**
 * Hem application/json (URL veya Base64) hem de multipart/form-data (Dosya yükleme / BLOB)
 * isteklerini ayrıştırır.
 */
async function parseAdminScreeningRequest(req: NextRequest): Promise<ParsedScreeningInput> {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const output: ParsedScreeningInput = {};

    if (formData.get('id')) output.id = Number(formData.get('id'));
    if (formData.get('user_id')) output.user_id = String(formData.get('user_id'));
    if (formData.get('movie_title') !== null) output.movie_title = String(formData.get('movie_title')).trim();
    if (formData.get('description') !== null) output.description = String(formData.get('description')).trim();
    if (formData.get('trailer_url') !== null) output.trailer_url = String(formData.get('trailer_url')).trim();
    if (formData.get('screening_date') !== null) output.screening_date = String(formData.get('screening_date')).trim();
    if (formData.get('screening_time') !== null) output.screening_time = String(formData.get('screening_time')).trim();
    if (formData.get('total_capacity') !== null) output.total_capacity = Number(formData.get('total_capacity'));

    const coverFile = formData.get('cover_image') || formData.get('cover_image_url');
    if (coverFile instanceof File && coverFile.size > 0) {
      const arrayBuffer = await coverFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      output.cover_imageBuffer = buffer;
      const mimeType = coverFile.type || 'image/jpeg';
      output.cover_image_url = `data:${mimeType};base64,${buffer.toString('base64')}`;
    } else if (typeof coverFile === 'string' && coverFile.trim() !== '') {
      output.cover_image_url = coverFile.trim();
      output.cover_imageBuffer = Buffer.from(coverFile.trim(), 'utf-8');
    }

    return output;
  }

  // JSON Body
  const body = await req.json();
  const output: ParsedScreeningInput = {
    id: body.id !== undefined ? Number(body.id) : undefined,
    user_id: body.user_id,
    movie_title: body.movie_title !== undefined ? String(body.movie_title).trim() : undefined,
    description: body.description !== undefined ? String(body.description).trim() : undefined,
    trailer_url: body.trailer_url !== undefined ? String(body.trailer_url).trim() : undefined,
    screening_date: body.screening_date !== undefined ? String(body.screening_date).trim() : undefined,
    screening_time: body.screening_time !== undefined ? String(body.screening_time).trim() : undefined,
    total_capacity: body.total_capacity !== undefined ? Number(body.total_capacity) : undefined,
  };

  const rawImage = body.cover_image_url ?? body.cover_image;
  if (typeof rawImage === 'string' && rawImage.trim() !== '') {
    const trimmed = rawImage.trim();
    output.cover_image_url = trimmed;
    if (trimmed.startsWith('data:')) {
      const base64Part = trimmed.split(',')[1];
      if (base64Part) {
        output.cover_imageBuffer = Buffer.from(base64Part, 'base64');
      } else {
        output.cover_imageBuffer = Buffer.from(trimmed, 'utf-8');
      }
    } else {
      output.cover_imageBuffer = Buffer.from(trimmed, 'utf-8');
    }
  }

  return output;
}

async function handleUpsertScreening(req: NextRequest) {
  try {
    const input = await parseAdminScreeningRequest(req);

    // 1. Admin Yetki Kontrolü (Backend tarafında zorunlu kontrol)
    const user = await getAuthenticatedUser(req, input.user_id);
    if (!user) {
      return NextResponse.json(
        { error: 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Bu işlemi gerçekleştirmek için admin yetkisine sahip olmalısınız.' },
        { status: 403 }
      );
    }

    // Mevcut gösterim kaydını kontrol et
    let existingRows: mysql.RowDataPacket[];
    if (input.id) {
      [existingRows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT * FROM screenings WHERE id = ? LIMIT 1',
        [input.id]
      );
    } else {
      [existingRows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT * FROM screenings ORDER BY id DESC LIMIT 1'
      );
    }

    const columns = await getScreeningsColumns();
    const hasUrlCol = columns.has('cover_image_url');
    const hasBlobCol = columns.has('cover_image');

    // Eğer base64 veri URL'si kaydedilecekse ve cover_image_url VARCHAR(255) ise sığması için LONGTEXT'e genişlet
    if (hasUrlCol && input.cover_image_url && input.cover_image_url.length > 250) {
      try {
        await pool.query('ALTER TABLE screenings MODIFY COLUMN cover_image_url LONGTEXT NOT NULL');
      } catch {
        // Yetki veya yapı kısıtı varsa yoksay
      }
    }

    // Tabloda henüz hiç gösterim yoksa yeni kayıt oluştur (INSERT)
    if (existingRows.length === 0) {
      if (
        !input.movie_title ||
        !input.description ||
        !input.trailer_url ||
        !input.cover_image_url ||
        !input.screening_date ||
        !input.screening_time ||
        input.total_capacity === undefined ||
        input.total_capacity <= 0
      ) {
        return NextResponse.json(
          {
            error:
              'Yeni film gösterimi oluşturmak için film adı, açıklama, fragman, kapak fotoğrafı, tarih, saat ve pozitif toplam kontenjan bilgileri eksiksiz gönderilmelidir.',
          },
          { status: 400 }
        );
      }

      const insertCols = [
        'movie_title',
        'description',
        'trailer_url',
        'screening_date',
        'screening_time',
        'total_capacity',
      ];
      const insertVals: unknown[] = [
        input.movie_title,
        input.description,
        input.trailer_url,
        input.screening_date,
        input.screening_time,
        input.total_capacity,
      ];

      if (hasUrlCol) {
        insertCols.push('cover_image_url');
        insertVals.push(input.cover_image_url);
      }
      if (hasBlobCol) {
        insertCols.push('cover_image');
        insertVals.push(input.cover_imageBuffer ?? Buffer.from(input.cover_image_url, 'utf-8'));
      }

      const placeholders = insertCols.map(() => '?').join(', ');
      const [insertResult] = await pool.query<mysql.ResultSetHeader>(
        `INSERT INTO screenings (${insertCols.join(', ')}) VALUES (${placeholders})`,
        insertVals
      );

      const [newRows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT * FROM screenings WHERE id = ? LIMIT 1',
        [insertResult.insertId]
      );

      const normalized = normalizeScreeningRow(newRows[0], 0);
      return NextResponse.json(
        {
          message: 'Film ve gösterim bilgileri başarıyla kaydedildi.',
          ...normalized,
          screening: normalized,
        },
        { status: 201 }
      );
    }

    // Mevcut gösterimi güncelle (UPDATE)
    const currentScreening = existingRows[0];
    const screeningId = Number(currentScreening.id);

    // Aktif rezervasyon sayısını bul
    const [countRows] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM reservations WHERE screening_id = ? AND status = 'active'",
      [screeningId]
    );
    const activeReservations = Number(countRows[0]?.count || 0);

    // Kural: Admin, mevcut aktif rezervasyon sayısından daha düşük bir kapasite belirleyememelidir.
    if (input.total_capacity !== undefined) {
      if (Number.isNaN(input.total_capacity) || input.total_capacity < 1) {
        return NextResponse.json(
          { error: 'Toplam kontenjan en az 1 olmalıdır.' },
          { status: 400 }
        );
      }

      if (input.total_capacity < activeReservations) {
        return NextResponse.json(
          {
            error: `Toplam kontenjan (${input.total_capacity}), mevcut aktif rezervasyon sayısından (${activeReservations}) daha düşük olamaz.`,
            active_reservations: activeReservations,
          },
          { status: 400 }
        );
      }
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.movie_title !== undefined && input.movie_title !== '') {
      updates.push('movie_title = ?');
      values.push(input.movie_title);
    }
    if (input.description !== undefined && input.description !== '') {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.trailer_url !== undefined && input.trailer_url !== '') {
      updates.push('trailer_url = ?');
      values.push(input.trailer_url);
    }
    if (input.screening_date !== undefined && input.screening_date !== '') {
      updates.push('screening_date = ?');
      values.push(input.screening_date);
    }
    if (input.screening_time !== undefined && input.screening_time !== '') {
      updates.push('screening_time = ?');
      values.push(input.screening_time);
    }
    if (input.total_capacity !== undefined) {
      updates.push('total_capacity = ?');
      values.push(input.total_capacity);
    }
    if (input.cover_image_url !== undefined && input.cover_image_url !== '') {
      if (hasUrlCol) {
        updates.push('cover_image_url = ?');
        values.push(input.cover_image_url);
      }
      if (hasBlobCol) {
        updates.push('cover_image = ?');
        values.push(input.cover_imageBuffer ?? Buffer.from(input.cover_image_url, 'utf-8'));
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'Güncellenecek herhangi bir alan gönderilmedi.' },
        { status: 400 }
      );
    }

    values.push(screeningId);
    await pool.query(
      `UPDATE screenings SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [updatedRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM screenings WHERE id = ? LIMIT 1',
      [screeningId]
    );

    const normalized = normalizeScreeningRow(updatedRows[0], activeReservations);

    return NextResponse.json(
      {
        message: 'Film ve gösterim bilgileri başarıyla güncellendi.',
        ...normalized,
        screening: normalized,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Admin Screening API Error:', error);
    return NextResponse.json(
      { error: 'Film bilgileri güncellenirken bir sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  return handleUpsertScreening(req);
}

export async function POST(req: NextRequest) {
  return handleUpsertScreening(req);
}

export async function PUT(req: NextRequest) {
  return handleUpsertScreening(req);
}
