import { NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { pinUnlockSchema } from '@/lib/validation';
import { getClientIp, getCurrentAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getCurrentAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Session expired. Please sign in with full password.' }, { status: 401 });
    }

    const ip = getClientIp(request);
    const body = await request.json();
    const validated = pinUnlockSchema.parse(body);

    const isMatch = await Database.verifyAdminPin(validated.pin);
    if (!isMatch) {
      await Database.logAudit('PIN_UNLOCK_FAILED', 'admin', ip);
      return NextResponse.json({ error: 'Incorrect quick-unlock PIN.' }, { status: 401 });
    }

    await Database.logAudit('PIN_UNLOCK_SUCCESS', 'admin', ip);
    return NextResponse.json({ success: true, message: 'Screen unlocked successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Validation error' }, { status: 400 });
  }
}
