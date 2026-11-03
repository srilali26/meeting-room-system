import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { getCurrentAdminSession, getClientIp } from '@/lib/auth';

export async function GET() {
  try {
    const screens = await Database.getDisplayScreens();
    return NextResponse.json({ screens });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch screens' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Admin session required.' }, { status: 401 });
    }

    const body = await req.json();
    if (!body.name || !body.room_id) {
      return NextResponse.json({ error: 'Name and Room are required' }, { status: 400 });
    }

    const screen = await Database.registerDisplayScreen({
      name: body.name,
      room_id: body.room_id,
      media_player_ip: body.media_player_ip || null,
      orientation: body.orientation === 'portrait' ? 'portrait' : 'landscape',
    });

    await Database.logAudit('REGISTER_SCREEN', 'admin', getClientIp(req), {
      screenId: screen.id,
      screenName: screen.name,
      roomId: screen.room_id,
    });

    return NextResponse.json({ screen }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to register screen' }, { status: 400 });
  }
}
