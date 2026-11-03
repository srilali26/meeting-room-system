import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { getCurrentAdminSession, getClientIp } from '@/lib/auth';
import { roomSchema } from '@/lib/validation';
import { computeRoomStatus } from '@/lib/timezone';

export async function GET(req: NextRequest) {
  try {
    const rooms = await Database.getRooms();
    const { searchParams } = new URL(req.url);
    const withStatus = searchParams.get('withStatus') === 'true';

    if (!withStatus) {
      return NextResponse.json({
        rooms,
        suggestedNextName: Database.suggestNextRoomName(),
      });
    }

    const bookings = await Database.getBookings();
    const blockedSlots = await Database.getBlockedSlots();
    const settings = await Database.getSettings();

    const roomsWithStatus = rooms.map((room) => {
      const rBookings = bookings.filter((b) => b.room_id === room.id);
      const rBlocked = blockedSlots.filter((b) => b.room_id === null || b.room_id === room.id);
      const status = computeRoomStatus(rBookings, rBlocked, settings);
      return {
        ...room,
        currentStatus: status,
      };
    });

    return NextResponse.json({
      rooms: roomsWithStatus,
      suggestedNextName: Database.suggestNextRoomName(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch rooms' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Admin session required.' }, { status: 401 });
    }

    const body = await req.json();
    if (!body.name) {
      body.name = Database.suggestNextRoomName();
    }

    const validated = roomSchema.parse(body);
    const room = await Database.createRoom(validated);

    await Database.logAudit('CREATE_ROOM', 'admin', getClientIp(req), {
      roomId: room.id,
      roomName: room.name,
    });

    return NextResponse.json({ room }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.errors ? error.errors[0]?.message : error.message || 'Failed to create room' },
      { status: 400 }
    );
  }
}
