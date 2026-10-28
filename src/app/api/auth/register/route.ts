import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import pool, { ensureUserColumns } from '@/lib/db';
import { signToken, AuthUser } from '@/lib/auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    // MySQL şemasında eksik sütun varsa otomatik ekle
    await ensureUserColumns();

    const body = await req.json();
    const { name, email, password, phone, student_number, department } = body;

    if (!name || !email || !password || !phone || !student_number || !department) {
      return NextResponse.json(
        { error: 'Lütfen tüm alanları (Ad Soyad, E-posta, Telefon, Öğrenci No, Bölüm, Parola) doldurun.' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const trimmedName = String(name).trim();
    const trimmedPhone = String(phone).trim();
    const trimmedStudentNo = String(student_number).trim();
    const trimmedDept = String(department).trim();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Lütfen geçerli bir e-posta adresi girin.' },
        { status: 400 }
      );
    }

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return NextResponse.json(
        { error: 'Ad soyad 2 ile 100 karakter arasında olmalıdır.' },
        { status: 400 }
      );
    }

    if (trimmedPhone.length < 7 || trimmedPhone.length > 20) {
      return NextResponse.json(
        { error: 'Lütfen geçerli bir telefon numarası girin.' },
        { status: 400 }
      );
    }

    if (trimmedStudentNo.length < 2 || trimmedStudentNo.length > 50) {
      return NextResponse.json(
        { error: 'Lütfen geçerli bir öğrenci numarası girin.' },
        { status: 400 }
      );
    }

    if (trimmedDept.length < 2 || trimmedDept.length > 100) {
      return NextResponse.json(
        { error: 'Lütfen bölüm adınızı eksiksiz girin.' },
        { status: 400 }
      );
    }

    const passwordStr = String(password);
    if (passwordStr.length < 6) {
      return NextResponse.json(
        { error: 'Parola en az 6 karakter olmalıdır.' },
        { status: 400 }
      );
    }

    if (passwordStr.length > 72) {
      return NextResponse.json(
        { error: 'Parola en fazla 72 karakter olabilir.' },
        { status: 400 }
      );
    }

    // E-posta adresi daha önce kayıtlı mı kontrol et
    const [existingUsers] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'Bu e-posta adresi ile zaten bir hesap kayıtlı.' },
        { status: 409 }
      );
    }

    // Parolayı güvenli biçimde hash'le
    const passwordHash = await bcrypt.hash(passwordStr, 10);

    // Yeni kullanıcıyı kaydet
    const [result] = await pool.query<mysql.ResultSetHeader>(
      'INSERT INTO users (name, email, phone, student_number, department, password_hash, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [trimmedName, normalizedEmail, trimmedPhone, trimmedStudentNo, trimmedDept, passwordHash, 'user']
    );

    const newUser: AuthUser = {
      id: result.insertId,
      name: trimmedName,
      email: normalizedEmail,
      phone: trimmedPhone,
      student_number: trimmedStudentNo,
      department: trimmedDept,
      role: 'user',
    };

    const token = signToken(newUser);

    const response = NextResponse.json(
      {
        message: 'Kayıt işlemi başarıyla tamamlandı.',
        user: {
          ...newUser,
          is_admin: false,
        },
        token,
      },
      { status: 201 }
    );

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (error) {
    console.error('Register API Error:', error);
    return NextResponse.json(
      { error: 'Kayıt işlemi sırasında bir sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
