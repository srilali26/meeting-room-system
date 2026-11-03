import { NextResponse } from 'next/server';
import { getCurrentAdminSession } from '@/lib/auth';
import { Database } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  const settings = await Database.getSettings();
  return NextResponse.json({
    authenticated: true,
    session: {
      last_activity_at: session.last_activity_at,
      expires_at: session.expires_at,
    },
    settings,
  });
}
