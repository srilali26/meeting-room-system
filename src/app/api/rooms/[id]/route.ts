import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { getCurrentAdminSession, getClientIp } from '@/lib/auth';
import { roomSchema } from '@/lib/validation';
import { computeRoomStatus, generateDaySlots, formatInDubai } from '@/lib/timezone';
import { generateRoomQRCodeDataUrl, generateRoomQRCodeSvg } from '@/lib/qr';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const room = await Database.getRoomById(params.id);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date') || formatInDubai(new Date(), 'yyyy-MM-dd');

    const bookings = await Database.getBookings(room.id, dateStr);
    const blockedSlots = await Database.getBlockedSlots(room.id, dateStr);
    const settings = await Database.getSettings();

    const slots = generateDaySlots(dateStr, bookings, blockedSlots, settings);
    const status = computeRoomStatus(bookings, blockedSlots, settings);

    // Generate QR codes for this room pointing to http://192.168.50.143/room/{roomId}
    const [qrDataUrl, qrSvg] = await Promise.all([
      generateRoomQRCodeDataUrl(room.id),
      generateRoomQRCodeSvg(room.id),
    ]);

    return NextResponse.json({
      room,
      date: dateStr,
      status,
      slots,
      qrDataUrl,
      qrSvg,
      qrTargetUrl: `http://192.168.50.143/room/${room.id}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch room' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getCurrentAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Admin session required.' }, { status: 401 });
    }

    const body = await req.json();
    const existing = await Database.getRoomById(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const partialSchema = roomSchema.partial();
    const validated = partialSchema.parse(body);

    const updated = await Database.updateRoom(params.id, validated);

    await Database.logAudit('UPDATE_ROOM', 'admin', getClientIp(req), {
      roomId: params.id,
      roomName: updated?.name,
      changes: validated,
    });

    return NextResponse.json({ room: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.errors ? error.errors[0]?.message : error.message || 'Failed to update room' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getCurrentAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Admin session required.' }, { status: 401 });
    }

    const updated = await Database.updateRoom(params.id, { is_active: false });
    if (!updated) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    await Database.logAudit('DEACTIVATE_ROOM', 'admin', getClientIp(req), {
      roomId: params.id,
      roomName: updated.name,
    });

    return NextResponse.json({ message: 'Room deactivated successfully', room: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to deactivate room' }, { status: 500 });
  }
}
