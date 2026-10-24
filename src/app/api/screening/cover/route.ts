import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import pool, { detectImageMimeType } from '@/lib/db';


/**
 * GET /api/screening/cover
 * Veritabanındaki cover_image (BLOB / LONGBLOB) sütununu doğrudan binary görsel olarak döndürür.
 * Frontend <img src="/api/screening/cover" /> şeklinde doğrudan kullanabilir.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');

    let rows: mysql.RowDataPacket[];
    if (idParam) {
      [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT cover_image FROM screenings WHERE id = ? LIMIT 1',
        [Number(idParam)]
      );
    } else {
      [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT cover_image FROM screenings ORDER BY id DESC LIMIT 1'
      );
    }

    if (rows.length === 0 || !rows[0].cover_image) {
      return NextResponse.json(
        { error: 'Kapak fotoğrafı (BLOB) bulunamadı.' },
        { status: 404 }
      );
    }

    const raw = rows[0].cover_image;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), 'base64');
    const mimeType = detectImageMimeType(buffer);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('GET /api/screening/cover Error:', error);
    return NextResponse.json(
      { error: 'Kapak fotoğrafı alınırken sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
