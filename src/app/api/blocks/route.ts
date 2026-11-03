import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { getCurrentAdminSession, getClientIp } from '@/lib/auth';
import { blockSlotSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId') || undefined;
    const blocks = await Database.getBlockedSlots(roomId);
    return NextResponse.json({ blocks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch blocks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Admin session required.' }, { status: 401 });
    }

    const body = await req.json();
    const validated = blockSlotSchema.parse(body);

    const result = await Database.createBlockedSlot(validated);

    await Database.logAudit('CREATE_BLOCKED_SLOT', 'admin', getClientIp(req), {
      blockId: result.blockedSlot.id,
      roomId: result.blockedSlot.room_id || 'ALL_ROOMS',
      title: result.blockedSlot.title,
      startTime: result.blockedSlot.start_time,
      endTime: result.blockedSlot.end_time,
      affectedBookings: result.affectedBookingsCount,
    });

    return NextResponse.json(
      {
        message: 'Time slot blocked successfully',
        blockedSlot: result.blockedSlot,
        affectedBookingsCount: result.affectedBookingsCount,
        warning:
          result.affectedBookingsCount > 0
            ? `${result.affectedBookingsCount} existing booking(s) fall within this blocked window.`
            : null,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.errors ? error.errors[0]?.message : error.message || 'Failed to block slot' },
      { status: 400 }
    );
  }
}
