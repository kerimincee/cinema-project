import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import pool, { ensureCoverImageBlobColumn, normalizeScreeningRow } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

interface ParsedScreeningInput {
  id?: number;
  user_id?: number | string;
  movie_title?: string;
  description?: string;
  trailer_url?: string;
  cover_image?: Buffer;
  screening_date?: string;
  screening_time?: string;
  total_capacity?: number;
}

/**
 * Base64 string veya Data URI (data:image/jpeg;base64,...) verisini binary Buffer (BLOB) nesnesine çevirir.
 */
function base64ToBuffer(input: string): Buffer | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx !== -1) {
      return Buffer.from(trimmed.slice(commaIdx + 1), 'base64');
    }
  }
  return Buffer.from(trimmed, 'base64');
}

/**
 * Admin panelinden gelen isteği ayrıştırır.
 * Sadece BLOB (binary görsel verisi) destekler:
 * 1) multipart/form-data içindeki File (cover_image) -> Buffer (BLOB)
 * 2) application/json içindeki Base64 kodlu görsel verisi (cover_image) -> Buffer (BLOB)
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

    const coverFile = formData.get('cover_image');
    if (coverFile instanceof File && coverFile.size > 0) {
      const arrayBuffer = await coverFile.arrayBuffer();
      output.cover_image = Buffer.from(arrayBuffer);
    } else if (typeof coverFile === 'string' && coverFile.trim() !== '') {
      const buf = base64ToBuffer(coverFile);
      if (buf) output.cover_image = buf;
    }

    return output;
  }

  // JSON Body (Base64 encoded BLOB)
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

  if (typeof body.cover_image === 'string' && body.cover_image.trim() !== '') {
    const buf = base64ToBuffer(body.cover_image);
    if (buf) output.cover_image = buf;
  } else if (Array.isArray(body.cover_image)) {
    output.cover_image = Buffer.from(body.cover_image);
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

    // Veritabanında cover_image (LONGBLOB) sütununun hazır olduğundan emin ol
    await ensureCoverImageBlobColumn();

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

    // Tabloda henüz hiç gösterim yoksa yeni kayıt oluştur (INSERT)
    if (existingRows.length === 0) {
      if (
        !input.movie_title ||
        !input.description ||
        !input.trailer_url ||
        !input.cover_image ||
        !input.screening_date ||
        !input.screening_time ||
        input.total_capacity === undefined ||
        input.total_capacity <= 0
      ) {
        return NextResponse.json(
          {
            error:
              'Yeni film gösterimi oluşturmak için film adı, açıklama, fragman, kapak fotoğrafı (cover_image BLOB), tarih, saat ve pozitif toplam kontenjan bilgileri eksiksiz gönderilmelidir.',
          },
          { status: 400 }
        );
      }

      const [insertResult] = await pool.query<mysql.ResultSetHeader>(
        `INSERT INTO screenings (movie_title, description, trailer_url, cover_image, screening_date, screening_time, total_capacity)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.movie_title,
          input.description,
          input.trailer_url,
          input.cover_image,
          input.screening_date,
          input.screening_time,
          input.total_capacity,
        ]
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
    if (input.cover_image && input.cover_image.length > 0) {
      updates.push('cover_image = ?');
      values.push(input.cover_image);
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
