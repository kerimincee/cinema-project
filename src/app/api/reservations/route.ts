import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import pool from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';


/**
 * GET /api/reservations
 * Giriş yapmış kullanıcının kendi rezervasyonlarını (admin ise tüm rezervasyonları) listeler.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Rezervasyonları görüntülemek için giriş yapmalısınız.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);

    if (user.role === 'admin' && searchParams.get('all') === 'true') {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT r.id, r.user_id, u.name AS user_name, u.email AS user_email,
                r.screening_id, s.movie_title, s.screening_date, s.screening_time,
                r.status, r.created_at
         FROM reservations r
         JOIN users u ON r.user_id = u.id
         JOIN screenings s ON r.screening_id = s.id
         ORDER BY r.created_at DESC`
      );
      return NextResponse.json({ reservations: rows }, { status: 200 });
    }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT r.id, r.user_id, r.screening_id, s.movie_title, s.screening_date, s.screening_time,
              r.status, r.created_at
       FROM reservations r
       JOIN screenings s ON r.screening_id = s.id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [user.id]
    );

    return NextResponse.json({ reservations: rows }, { status: 200 });
  } catch (error) {
    console.error('GET /api/reservations Error:', error);
    return NextResponse.json(
      { error: 'Rezervasyon bilgileri alınırken bir hata oluştu.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reservations
 * Kullanıcının yer ayırtma işlemini gerçekleştirir.
 * - Transaction ve satır kilitleme (FOR UPDATE) ile eşzamanlı isteklerde (race condition) kontenjan aşımını engeller.
 * - Aynı kullanıcının aynı gösterime birden fazla aktif rezervasyon yapmasını engeller.
 */
export async function POST(req: NextRequest) {
  let connection: mysql.PoolConnection | null = null;

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Yer ayırtmak için lütfen önce giriş yapın.' },
        { status: 401 }
      );
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Gösterim ID'si gönderilmişse onu, gönderilmemişse son aktif gösterimi kilitleyerek (FOR UPDATE) seç
    const requestedScreeningId = body.screening_id ? Number(body.screening_id) : null;
    let screeningRows: mysql.RowDataPacket[];

    if (requestedScreeningId) {
      [screeningRows] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT id, movie_title, total_capacity FROM screenings WHERE id = ? FOR UPDATE',
        [requestedScreeningId]
      );
    } else {
      [screeningRows] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT id, movie_title, total_capacity FROM screenings ORDER BY id DESC LIMIT 1 FOR UPDATE'
      );
    }

    if (screeningRows.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: 'Rezervasyon yapılacak aktif bir gösterim bulunamadı.' },
        { status: 404 }
      );
    }

    const screening = screeningRows[0];
    const screeningId = Number(screening.id);
    const totalCapacity = Number(screening.total_capacity);

    // 1. Kural: Kullanıcının aynı gösterim için zaten aktif bir rezervasyonu var mı?
    const [existingUserRes] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT id FROM reservations WHERE user_id = ? AND screening_id = ? AND status = 'active' LIMIT 1",
      [user.id, screeningId]
    );

    if (existingUserRes.length > 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: 'Bu gösterim için zaten aktif bir rezervasyonunuz bulunmaktadır.' },
        { status: 409 }
      );
    }

    // 2. Kural: Kontenjan dolmuş mu kontrol et
    const [countRows] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM reservations WHERE screening_id = ? AND status = 'active'",
      [screeningId]
    );
    const activeReservations = Number(countRows[0]?.count || 0);

    if (activeReservations >= totalCapacity) {
      await connection.rollback();
      return NextResponse.json(
        {
          error: 'Salon kontenjanı dolmuştur. Yeni rezervasyon yapılamamaktadır.',
          total_capacity: totalCapacity,
          remaining_capacity: 0,
          is_full: true,
        },
        { status: 400 }
      );
    }

    // 3. Rezervasyonu oluştur
    const [insertResult] = await connection.query<mysql.ResultSetHeader>(
      "INSERT INTO reservations (user_id, screening_id, status) VALUES (?, ?, 'active')",
      [user.id, screeningId]
    );

    await connection.commit();

    const newActiveCount = activeReservations + 1;
    const remainingCapacity = Math.max(0, totalCapacity - newActiveCount);

    return NextResponse.json(
      {
        message: 'Rezervasyonunuz başarıyla oluşturuldu!',
        reservation: {
          id: insertResult.insertId,
          user_id: user.id,
          screening_id: screeningId,
          status: 'active',
        },
        total_capacity: totalCapacity,
        active_reservations: newActiveCount,
        remaining_capacity: remainingCapacity,
        is_full: remainingCapacity <= 0,
      },
      { status: 201 }
    );
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore rollback error
      }
    }
    console.error('POST /api/reservations Error:', error);
    return NextResponse.json(
      { error: 'Rezervasyon işlemi sırasında bir sunucu hatası oluştu.' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * DELETE /api/reservations
 * Kullanıcının aktif rezervasyonunu iptal etmesini sağlar (status = 'cancelled').
 * Güvenlik: Tüm rezervasyonların kazara silinmesini önlemek için reservation_id veya screening_id zorunludur.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Rezervasyon iptali için giriş yapmalısınız.' },
        { status: 401 }
      );
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { searchParams } = new URL(req.url);
    const reservationId = body.reservation_id ?? searchParams.get('id');
    const screeningId = body.screening_id ?? searchParams.get('screening_id');

    if (!reservationId && !screeningId) {
      return NextResponse.json(
        { error: 'İptal edilecek rezervasyon numarası (id) veya gösterim numarası (screening_id) belirtilmelidir.' },
        { status: 400 }
      );
    }

    let result: mysql.ResultSetHeader;
    if (reservationId) {
      [result] = await pool.query<mysql.ResultSetHeader>(
        "UPDATE reservations SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'active'",
        [Number(reservationId), user.id]
      );
    } else {
      [result] = await pool.query<mysql.ResultSetHeader>(
        "UPDATE reservations SET status = 'cancelled' WHERE screening_id = ? AND user_id = ? AND status = 'active'",
        [Number(screeningId), user.id]
      );
    }

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: 'İptal edilecek aktif bir rezervasyon bulunamadı.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Rezervasyonunuz iptal edildi.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('DELETE /api/reservations Error:', error);
    return NextResponse.json(
      { error: 'Rezervasyon iptal edilirken bir sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
