import crypto from 'crypto';
import { NextRequest } from 'next/server';
import pool from './db';
import mysql from 'mysql2/promise';

const JWT_SECRET = process.env.JWT_SECRET || 'cinema-reservation-secret-key-2026';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
}

/**
 * Kullanıcı bilgileriyle imzalı bir JWT (JSON Web Token) üretir.
 */
export function signToken(user: AuthUser): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 gün geçerli
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Gönderilen JWT token'ı doğrular ve içindeki kullanıcı bilgisini döndürür.
 * Zamanlama saldırılarını (timing attack) önlemek için sabit zamanlı Buffer karşılaştırması kullanılır.
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      id: Number(decoded.id),
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

/**
 * İstekten (Authorization Header veya HttpOnly Cookie) kullanıcıyı tespit eder
 * ve veritabanından güncel yetkisini (user / admin) doğrular.
 * Güvenlik nedeniyle gövde (body) veya özel başlıklardan (x-user-id) yetkilendirme KESİNLİKLE kabul edilmez.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthUser | null> {
  let userId: number | null = null;

  // 1. Authorization: Bearer <token> kontrolü
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const tokenUser = verifyToken(token);
    if (tokenUser) {
      userId = tokenUser.id;
    }
  }

  // 2. Cookie (auth_token) kontrolü
  if (!userId) {
    const cookieToken = req.cookies.get('auth_token')?.value;
    if (cookieToken) {
      const tokenUser = verifyToken(cookieToken);
      if (tokenUser) {
        userId = tokenUser.id;
      }
    }
  }

  if (!userId) return null;

  // Kullanıcının varlığını ve güncel rolünü (user / admin) veritabanından doğrula
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (rows.length === 0) return null;

  const userRow = rows[0];
  return {
    id: Number(userRow.id),
    name: String(userRow.name),
    email: String(userRow.email),
    role: userRow.role === 'admin' ? 'admin' : 'user',
  };
}
