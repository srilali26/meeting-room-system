import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { getCurrentAdminSession, getClientIp } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Cancellation token is required' }, { status: 400 });
    }

    const booking = await Database.getBookingByCancelToken(token);
    if (!booking) {
      return NextResponse.json({ error: 'Invalid or expired cancellation link' }, { status: 404 });
    }

    const room = await Database.getRoomById(booking.room_id);

    return NextResponse.json({
      booking,
      roomName: room?.name || 'Meeting Room',
      isAlreadyCancelled: booking.status === 'cancelled',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to verify token' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientIp = getClientIp(req);

    if (body.token) {
      // Employee secret token cancellation
      const booking = await Database.cancelBookingByToken(body.token);

      await Database.logAudit('EMPLOYEE_CANCEL_BOOKING', booking.organizer_name, clientIp, {
        bookingId: booking.id,
        title: booking.title,
        tokenUsed: true,
      });

      return NextResponse.json({
        message: 'Your meeting reservation has been cancelled successfully.',
        booking,
      });
    }

    if (body.bookingId) {
      // Admin cancellation
      const session = await getCurrentAdminSession();
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized. Admin session required.' }, { status: 401 });
      }

      const booking = await Database.adminCancelBooking(body.bookingId);

      await Database.logAudit('ADMIN_CANCEL_BOOKING', 'admin', clientIp, {
        bookingId: booking.id,
        title: booking.title,
      });

      return NextResponse.json({
        message: 'Meeting booking cancelled by administrator.',
        booking,
      });
    }

    return NextResponse.json({ error: 'Either token or bookingId is required' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to cancel booking' }, { status: 400 });
  }
}
