import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Database } from '@/lib/db';
import { adminLoginSchema } from '@/lib/validation';
import { getClientIp, setAdminSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const body = await request.json();
    const validated = adminLoginSchema.parse(body);

    const admin = await Database.getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Admin account has not been initialized.' }, { status: 500 });
    }

    // Check lockout
    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      const remainingMs = new Date(admin.locked_until).getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
      return NextResponse.json(
        {
          error: `Account is temporarily locked due to excessive failed attempts. Try again in ${remainingMinutes} minute(s).`,
          locked: true,
          minutesRemaining: remainingMinutes,
        },
        { status: 429 }
      );
    }

    // Validate username (only exactly ONE admin account exists: "admin")
    if (validated.username.toLowerCase() !== admin.username.toLowerCase()) {
      const lockStatus = await Database.recordFailedLogin(ip);
      return NextResponse.json(
        {
          error: 'Invalid credentials. Access restricted to authorized personnel.',
          ...lockStatus,
        },
        { status: 401 }
      );
    }

    // Verify password with bcrypt
    const isMatch = bcrypt.compareSync(validated.password, admin.password_hash);
    if (!isMatch) {
      const lockStatus = await Database.recordFailedLogin(ip);
      const remainingAttempts = Math.max(0, 5 - admin.failed_attempts);
      const msg = lockStatus.locked
        ? 'Account has been locked for 15 minutes due to 5 failed attempts.'
        : `Invalid password. ${remainingAttempts} attempt(s) remaining before account lockout.`;

      return NextResponse.json(
        {
          error: msg,
          ...lockStatus,
        },
        { status: 401 }
      );
    }

    // Successful login: reset failed attempts
    await Database.resetFailedLogin();
    const session = await Database.createAdminSession(ip, request.headers.get('user-agent') || undefined);
    setAdminSessionCookie(session.token);

    await Database.logAudit('ADMIN_LOGIN', 'admin', ip, {
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      token: session.token,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Authentication error' }, { status: 400 });
  }
}
