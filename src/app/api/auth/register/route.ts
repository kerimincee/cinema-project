import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import pool from '@/lib/db';
import { signToken, AuthUser } from '@/lib/auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Ad soyad, e-posta ve parola alanları zorunludur.' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const trimmedName = String(name).trim();

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
        { error: 'Bu e-posta adresi ile zaten bir hesap mevcut.' },
        { status: 409 }
      );
    }

    // Parolayı güvenli biçimde özetle (hash)
    const passwordHash = await bcrypt.hash(passwordStr, 10);

    // Yeni kullanıcıyı kaydet (varsayılan rol: 'user')
    const [result] = await pool.query<mysql.ResultSetHeader>(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [trimmedName, normalizedEmail, passwordHash, 'user']
    );

    const newUser: AuthUser = {
      id: result.insertId,
      name: trimmedName,
      email: normalizedEmail,
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
