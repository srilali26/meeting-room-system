'use client';

import * as React from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Room, TimelineSlot } from '@/types';
import { formatInDubai, createDubaiDateTime } from '@/lib/timezone';
import { CheckCircle2, AlertCircle, Copy, ExternalLink, Clock, User, Mail, FileText } from 'lucide-react';
import { addMinutes, differenceInMinutes, parseISO } from 'date-fns';

interface BookingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  selectedDate: string;
  initialSlot: TimelineSlot | null;
  onBookingSuccess: () => void;
}

export function BookingSheet({
  isOpen,
  onClose,
  room,
  selectedDate,
  initialSlot,
  onBookingSuccess,
}: BookingSheetProps) {
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [startTimeStr, setStartTimeStr] = React.useState('');
  const [endTimeStr, setEndTimeStr] = React.useState('');
  const [durationMinutes, setDurationMinutes] = React.useState(30);

  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successData, setSuccessData] = React.useState<{
    booking: any;
    cancelUrl: string;
  } | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Initialize times when slot opens
  React.useEffect(() => {
    if (initialSlot && isOpen) {
      const s = new Date(initialSlot.startTime);
      const e = new Date(initialSlot.endTime);
      setStartTimeStr(s.toISOString());
      setEndTimeStr(e.toISOString());
      setDurationMinutes(30);
      setErrorMessage(null);
      setSuccessData(null);
    }
  }, [initialSlot, isOpen]);

  const handleDurationChange = (minutes: number) => {
    if (!startTimeStr) return;
    setDurationMinutes(minutes);
    const newEnd = addMinutes(new Date(startTimeStr), minutes);
    setEndTimeStr(newEnd.toISOString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: room.id,
          title: title.trim(),
          organizer_name: fullName.trim(),
          organizer_email: email.trim(),
          start_time: startTimeStr,
          end_time: endTimeStr,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to complete booking. Please try again.');
        setIsLoading(false);
        return;
      }

      setSuccessData({
        booking: data.booking,
        cancelUrl: data.cancel_url,
      });
      onBookingSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!successData) return;
    const fullCancelLink = `${window.location.origin}${successData.cancelUrl}`;
    navigator.clipboard.writeText(fullCancelLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const startFormatted = startTimeStr ? formatInDubai(startTimeStr, 'HH:mm') : '';
  const endFormatted = endTimeStr ? formatInDubai(endTimeStr, 'HH:mm') : '';
  const dayFormatted = startTimeStr ? formatInDubai(startTimeStr, 'EEE, d MMM yyyy') : selectedDate;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={successData ? 'Booking Confirmed' : `Reserve ${room.name}`}
      description={
        successData
          ? 'Your meeting has been scheduled and broadcast in realtime.'
          : `${dayFormatted} • ${startFormatted} – ${endFormatted} (${durationMinutes} min)`
      }
      maxWidth="md"
    >
      {successData ? (
        <div className="space-y-5 py-2">
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-sm">
            <CheckCircle2 className="w-8 h-8 text-corporate-green flex-shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-corporate-navy">Reservation Confirmed!</h4>
              <p className="text-xs text-slate-600 mt-0.5">
                {room.name} is now reserved for <span className="font-semibold">{successData.booking.title}</span> on{' '}
                {dayFormatted} ({startFormatted}–{endFormatted}).
              </p>
            </div>
          </div>

          <div className="border border-corporate-hairline rounded-sm p-4 bg-corporate-offwhite/50 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-corporate-charcoal">Secret Cancellation Link:</span>
              <span className="text-[10px] text-slate-500">No login required to cancel</span>
            </div>
            <p className="text-xs text-slate-600">
              Save this link in case your plans change. You can cancel this reservation at any time:
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={typeof window !== 'undefined' ? `${window.location.origin}${successData.cancelUrl}` : successData.cancelUrl}
                className="text-xs font-mono bg-white border border-corporate-hairline rounded-sm px-2.5 py-1.5 w-full text-slate-700"
              />
              <Button size="sm" variant="outline" onClick={handleCopyLink} title="Copy cancel link">
                <Copy className="w-3.5 h-3.5 mr-1" />
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-corporate-hairline">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open(successData.cancelUrl, '_blank');
                }
              }}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Test Cancel Page
            </Button>
            <Button variant="primary" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-corporate-red text-xs rounded-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to reserve slot</p>
                <p className="mt-0.5 text-slate-700">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Quick Duration Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-corporate-charcoal mb-1.5">
              Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[30, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleDurationChange(mins)}
                  className={`py-1.5 text-xs font-medium rounded-sm border transition-colors ${
                    durationMinutes === mins
                      ? 'bg-corporate-navy text-white border-corporate-navy'
                      : 'bg-white hover:bg-corporate-offwhite text-corporate-charcoal border-corporate-hairline'
                  }`}
                >
                  {mins === 60 ? '1 Hour' : mins === 90 ? '1.5 Hours' : mins === 120 ? '2 Hours' : '30 Min'}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
              <span>Time: {startFormatted} to {endFormatted}</span>
              <span>Max allowed: 4 hours</span>
            </div>
          </div>

          <Input
            id="booking-full-name"
            label="Full Name"
            placeholder="e.g. John Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />

          <Input
            id="booking-email"
            label="Work Email"
            type="email"
            placeholder="e.g. j.doe@company.internal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            id="booking-title"
            label="Meeting Title"
            placeholder="e.g. Project Architecture Sync"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-corporate-charcoal">
              Optional Notes / Agenda
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Projector required, 6 attendees"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-sm rounded-sm border border-corporate-hairline p-2.5 bg-white text-corporate-charcoal focus:outline-none focus:ring-2 focus:ring-corporate-teal"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-corporate-hairline">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
              Confirm Reservation
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
