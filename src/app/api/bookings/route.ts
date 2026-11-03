import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { getCurrentAdminSession, getClientIp } from '@/lib/auth';
import { bookingFormSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId') || undefined;
    const dateStr = searchParams.get('date') || undefined;
    const status = searchParams.get('status') || undefined;
    const query = searchParams.get('q')?.toLowerCase() || '';

    const session = await getCurrentAdminSession();
    const isAdmin = !!session;
    const settings = await Database.getSettings();

    let bookings = await Database.getBookings(roomId, dateStr);

    if (status) {
      bookings = bookings.filter((b) => b.status === status);
    }

    if (query) {
      bookings = bookings.filter(
        (b) =>
          b.title.toLowerCase().includes(query) ||
          b.organizer_name.toLowerCase().includes(query) ||
          b.organizer_email.toLowerCase().includes(query)
      );
    }

    // Apply privacy mode if enabled and requester is NOT an admin
    if (settings.privacy_mode && !isAdmin) {
      bookings = bookings.map((b) => ({
        ...b,
        title: 'Booked',
        organizer_name: 'Employee',
        organizer_email: 'hidden@internal',
        notes: null,
        cancel_token: '***',
      }));
    }

    return NextResponse.json({ bookings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch bookings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session = await getCurrentAdminSession();
    const isAdmin = !!session;
    const clientIp = getClientIp(req);

    // Validate request schema
    const validated = bookingFormSchema.parse(body);

    // Attempt creation with overlap & block checks
    const booking = await Database.createBooking(validated);

    await Database.logAudit(
      isAdmin ? 'ADMIN_CREATE_BOOKING' : 'EMPLOYEE_CREATE_BOOKING',
      isAdmin ? 'admin' : validated.organizer_name,
      clientIp,
      {
        bookingId: booking.id,
        roomId: booking.room_id,
        title: booking.title,
        startTime: booking.start_time,
        endTime: booking.end_time,
      }
    );

    return NextResponse.json(
      {
        message: 'Booking confirmed successfully',
        booking,
        cancel_url: `/booking/cancel?token=${booking.cancel_token}`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    // Check exclusion constraint overlap code
    if (error.code === '23P01') {
      return NextResponse.json(
        {
          error: error.message || 'This slot was just taken, please pick another.',
          code: '23P01',
        },
        { status: 409 }
      );
    }

    if (error.code === 'SLOT_BLOCKED') {
      return NextResponse.json(
        {
          error: error.message || 'This time slot is blocked and unavailable for booking.',
          code: 'SLOT_BLOCKED',
        },
        { status: 400 }
      );
    }

    if (error.errors && Array.isArray(error.errors)) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: 400 }
    );
  }
}
