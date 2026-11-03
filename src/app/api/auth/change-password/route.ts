import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Database } from '@/lib/db';
import { changePasswordSchema } from '@/lib/validation';
import { getCurrentAdminSession, getClientIp } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getCurrentAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = getClientIp(request);
    const body = await request.json();
    const validated = changePasswordSchema.parse(body);

    const admin = await Database.getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Admin account not found' }, { status: 500 });
    }

    const isMatch = bcrypt.compareSync(validated.current_password, admin.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Current password does not match.' }, { status: 400 });
    }

    const newHash = bcrypt.hashSync(validated.new_password, 10);
    await Database.updateAdminPassword(newHash);
    await Database.logAudit('ADMIN_PASSWORD_CHANGED', 'admin', ip);

    return NextResponse.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
