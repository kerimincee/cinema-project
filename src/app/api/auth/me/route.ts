import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';


export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          ...user,
          is_admin: user.role === 'admin',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Auth Me Error:', error);
    return NextResponse.json(
      { error: 'Kullanıcı bilgileri kontrol edilirken hata oluştu.' },
      { status: 500 }
    );
  }
}
