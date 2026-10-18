import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import pool from '@/lib/db';
import { signToken, AuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-posta ve parola alanları zorunludur.' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'E-posta adresi veya parola hatalı.' },
        { status: 401 }
      );
    }

    const userRow = rows[0];
    const storedHash = String(userRow.password_hash);

    // Bcrypt hash kontrolü (test amaçlı veritabanına elle girilmiş hashlenmemiş parola varsa onu da yedek olarak kontrol eder)
    let isPasswordValid = false;
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
      isPasswordValid = await bcrypt.compare(String(password), storedHash);
    } else {
      isPasswordValid = String(password) === storedHash;
    }

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'E-posta adresi veya parola hatalı.' },
        { status: 401 }
      );
    }

    const role: 'user' | 'admin' = userRow.role === 'admin' ? 'admin' : 'user';
    const authUser: AuthUser = {
      id: Number(userRow.id),
      name: String(userRow.name),
      email: String(userRow.email),
      role,
    };

    const token = signToken(authUser);

    const response = NextResponse.json(
      {
        message: 'Giriş başarılı.',
        user: {
          ...authUser,
          is_admin: role === 'admin',
        },
        token,
      },
      { status: 200 }
    );

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Login API Error:', error);
    return NextResponse.json(
      { error: 'Giriş işlemi sırasında bir sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
