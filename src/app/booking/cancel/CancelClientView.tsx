'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatInDubai } from '@/lib/timezone';
import { Calendar, Clock, MapPin, User, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export function CancelClientView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [bookingData, setBookingData] = React.useState<any>(null);
  const [isCancelledSuccess, setIsCancelledSuccess] = React.useState(false);

  React.useEffect(() => {
    if (!token) {
      setError('No cancellation token provided in the URL.');
      setIsLoading(false);
      return;
    }

    const fetchBooking = async () => {
      try {
        const res = await fetch(`/api/bookings/cancel?token=${token}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Invalid or expired cancellation link.');
        } else {
          setBookingData(data);
          if (data.isAlreadyCancelled) {
            setIsCancelledSuccess(true);
          }
        }
      } catch (e: any) {
        setError('Failed to connect to the server.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooking();
  }, [token]);

  const handleConfirmCancel = async () => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to cancel reservation.');
      } else {
        setIsCancelledSuccess(true);
      }
    } catch (e: any) {
      setError('Network error while cancelling reservation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-corporate-offwhite flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-corporate-navy border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Verifying reservation details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-corporate-offwhite flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-corporate-hairline rounded-sm shadow-md p-6 sm:p-8">
        {/* App Title */}
        <div className="border-b border-corporate-hairline pb-4 mb-6">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Internal Meeting Room System
          </span>
          <h1 className="text-xl font-extrabold text-corporate-navy mt-1">
            Cancel Meeting Reservation
          </h1>
        </div>

        {error ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 text-corporate-red rounded-sm text-xs">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Cancellation Error</p>
                <p className="mt-0.5 text-slate-700">{error}</p>
              </div>
            </div>
            <Link href="/" className="block">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Room Directory
              </Button>
            </Link>
          </div>
        ) : isCancelledSuccess ? (
          <div className="space-y-6 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-corporate-green rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-corporate-navy">
                Reservation Cancelled
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Your reservation for <span className="font-semibold">{bookingData?.booking?.title}</span> in{' '}
                <span className="font-semibold">{bookingData?.roomName}</span> has been released. The slot is now
                free for other colleagues to book.
              </p>
            </div>
            <Link href={`/room/${bookingData?.booking?.room_id}`}>
              <Button variant="primary" className="w-full">
                View Room Availability
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="border border-corporate-hairline rounded-sm p-4 bg-corporate-offwhite/50 space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Meeting Details
                </span>
                <h3 className="text-base font-bold text-corporate-navy mt-0.5">
                  {bookingData?.booking?.title}
                </h3>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 border-t border-corporate-hairline pt-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-corporate-teal flex-shrink-0" />
                  <span className="font-medium text-corporate-charcoal">{bookingData?.roomName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-corporate-teal flex-shrink-0" />
                  <span>{formatInDubai(bookingData?.booking?.start_time, 'EEEE, d MMMM yyyy')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-corporate-teal flex-shrink-0" />
                  <span>
                    {formatInDubai(bookingData?.booking?.start_time, 'HH:mm')} –{' '}
                    {formatInDubai(bookingData?.booking?.end_time, 'HH:mm')} (Dubai Time)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-corporate-teal flex-shrink-0" />
                  <span>Organized by {bookingData?.booking?.organizer_name}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Are you sure you want to cancel this reservation? The slot will become immediately available for others to book.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link href={`/room/${bookingData?.booking?.room_id}`} className="w-1/2">
                <Button type="button" variant="outline" className="w-full">
                  Keep Booking
                </Button>
              </Link>
              <Button
                type="button"
                variant="danger"
                className="w-1/2"
                isLoading={isSubmitting}
                onClick={handleConfirmCancel}
              >
                Confirm Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
