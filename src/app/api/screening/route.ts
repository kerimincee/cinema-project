import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import pool, { normalizeScreeningRow } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const screeningIdParam = searchParams.get('id');

    let screeningRows: mysql.RowDataPacket[];

    if (screeningIdParam) {
      [screeningRows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT * FROM screenings WHERE id = ? LIMIT 1',
        [Number(screeningIdParam)]
      );
    } else {
      // Aktif/son eklenen gösterimi getir
      [screeningRows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT * FROM screenings ORDER BY id DESC LIMIT 1'
      );
    }

    if (screeningRows.length === 0) {
      return NextResponse.json(
        {
          error: 'Henüz aktif bir film gösterimi bulunmamaktadır.',
          screening: null,
        },
        { status: 404 }
      );
    }

    const screeningRow = screeningRows[0];
    const screeningId = Number(screeningRow.id);

    // Bu gösterim için aktif rezervasyon sayısını hesapla
    const [countRows] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM reservations WHERE screening_id = ? AND status = 'active'",
      [screeningId]
    );
    const activeReservations = Number(countRows[0]?.count || 0);

    // Giriş yapmış kullanıcı varsa bu gösterime zaten rezervasyon yapmış mı kontrol et (Sadece geçerli Token/Cookie ile)
    const user = await getAuthenticatedUser(req);
    let hasReserved = false;

    if (user) {
      const [userResRows] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT id FROM reservations WHERE screening_id = ? AND user_id = ? AND status = 'active' LIMIT 1",
        [screeningId, user.id]
      );
      hasReserved = userResRows.length > 0;
    }

    const normalized = normalizeScreeningRow(screeningRow, activeReservations);
    const result = {
      ...normalized,
      has_reserved: hasReserved,
    };

    return NextResponse.json(
      {
        ...result,
        screening: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/screening Error:', error);
    return NextResponse.json(
      { error: 'Film ve gösterim bilgileri alınırken bir sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
