import { NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { clearAdminSessionCookie, getClientIp, SESSION_COOKIE_NAME } from '@/lib/auth';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      await Database.deleteAdminSession(token);
    }
    clearAdminSessionCookie();

    await Database.logAudit('ADMIN_LOGOUT', 'admin', ip);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
