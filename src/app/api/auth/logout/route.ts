import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json(
    { message: 'Çıkış yapıldı.' },
    { status: 200 }
  );

  response.cookies.set('auth_token', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });

  return response;
}
