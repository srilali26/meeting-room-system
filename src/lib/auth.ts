import { cookies } from 'next/headers';
import { Database } from './db';
import { AdminSession } from '@/types';

export const SESSION_COOKIE_NAME = 'admin_session';

export function getClientIp(request?: Request): string {
  if (!request) return '127.0.0.1';
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '192.168.50.143';
}

export async function getCurrentAdminSession(): Promise<AdminSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return await Database.verifyAdminSession(token);
}

export function setAdminSessionCookie(token: string) {
  const cookieStore = cookies();
  const isSecure = process.env.COOKIE_SECURE === 'true';
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days sliding renewal
  });
}

export function clearAdminSessionCookie() {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 0,
  });
}
