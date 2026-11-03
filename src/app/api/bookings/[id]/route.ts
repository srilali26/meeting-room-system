import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { getCurrentAdminSession, getClientIp } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const booking = await Database.getBookingById(params.id);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    return NextResponse.json({ booking });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch booking' }, { status: 500 });
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
    const existing = await Database.getBookingById(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const updated = await Database.updateBooking(params.id, body);

    await Database.logAudit('ADMIN_UPDATE_BOOKING', 'admin', getClientIp(req), {
      bookingId: params.id,
      updates: body,
    });

    return NextResponse.json({ booking: updated });
  } catch (error: any) {
    if (error.code === '23P01') {
      return NextResponse.json(
        { error: 'The updated time slot overlaps with an existing booking.', code: '23P01' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message || 'Failed to update booking' }, { status: 400 });
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

    const booking = await Database.adminCancelBooking(params.id);

    await Database.logAudit('ADMIN_CANCEL_BOOKING', 'admin', getClientIp(req), {
      bookingId: params.id,
      title: booking.title,
    });

    return NextResponse.json({ message: 'Booking cancelled successfully', booking });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to cancel booking' }, { status: 400 });
  }
}
