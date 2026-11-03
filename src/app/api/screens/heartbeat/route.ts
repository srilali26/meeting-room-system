import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { getClientIp } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token;

    if (!token) {
      return NextResponse.json({ error: 'Display token is required' }, { status: 400 });
    }

    const ip = getClientIp(req);
    const shouldReload = await Database.recordScreenHeartbeat(token, ip);

    return NextResponse.json({
      success: true,
      reload_requested: shouldReload,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Heartbeat error' }, { status: 500 });
  }
}
