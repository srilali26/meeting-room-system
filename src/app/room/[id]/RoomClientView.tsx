'use client';

import * as React from 'react';
import { Room, RoomStatusInfo, TimelineSlot } from '@/types';
import { DatePickerStrip } from '@/components/DatePickerStrip';
import { VerticalTimeline } from '@/components/VerticalTimeline';
import { BookingSheet } from '@/components/BookingSheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatInDubai } from '@/lib/timezone';
import {
  Users,
  MapPin,
  CheckCircle2,
  Clock,
  Sparkles,
  Printer,
  QrCode,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

interface RoomClientViewProps {
  initialRoom: Room;
  initialStatus: RoomStatusInfo;
  initialSlots: TimelineSlot[];
  initialDate: string;
  qrDataUrl: string;
}

export function RoomClientView({
  initialRoom,
  initialStatus,
  initialSlots,
  initialDate,
  qrDataUrl,
}: RoomClientViewProps) {
  const [selectedDate, setSelectedDate] = React.useState<string>(initialDate);
  const [room, setRoom] = React.useState<Room>(initialRoom);
  const [status, setStatus] = React.useState<RoomStatusInfo>(initialStatus);
  const [slots, setSlots] = React.useState<TimelineSlot[]>(initialSlots);
  const [isBookingSheetOpen, setIsBookingSheetOpen] = React.useState(false);
  const [selectedSlot, setSelectedSlot] = React.useState<TimelineSlot | null>(null);
  const [showQrModal, setShowQrModal] = React.useState(false);

  // Fetch updated schedule
  const fetchSchedule = React.useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/rooms/${room.id}?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setRoom(data.room);
        setStatus(data.status);
        setSlots(data.slots);
      }
    } catch (e) {
      console.error('Failed to refresh room schedule', e);
    }
  }, [room.id]);

  // Handle date change
  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    fetchSchedule(date);
  };

  // Real-time SSE listener
  React.useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime');
      es.addEventListener('bookings', () => {
        fetchSchedule(selectedDate);
      });
      es.addEventListener('blocked_slots', () => {
        fetchSchedule(selectedDate);
      });
      es.addEventListener('rooms', () => {
        fetchSchedule(selectedDate);
      });
    } catch (err) {
      console.warn('Realtime event source init error', err);
    }

    return () => {
      if (es) es.close();
    };
  }, [fetchSchedule, selectedDate]);

  // Click on free slot
  const handleSlotClick = (slot: TimelineSlot) => {
    setSelectedSlot(slot);
    setIsBookingSheetOpen(true);
  };

  // One-tap quick booking for next 30 min if free now
  const handleBookNext30Min = () => {
    const freeSlot = slots.find((s) => s.state === 'free');
    if (freeSlot) {
      setSelectedSlot(freeSlot);
      setIsBookingSheetOpen(true);
    }
  };

  const isFreeNow = status.state === 'available';
  const isOccupied = status.state === 'occupied';
  const isBlocked = status.state === 'blocked';

  return (
    <div className="min-h-screen bg-corporate-offwhite pb-16">
      {/* Top Header Card */}
      <div className="bg-white border-b border-corporate-hairline">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-corporate-navy tracking-tight">
                  {room.name}
                </h1>
                {!room.is_active && (
                  <Badge variant="unavailable">Inactive</Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                <span className="flex items-center gap-1.5 font-medium text-corporate-charcoal">
                  <MapPin className="w-3.5 h-3.5 text-corporate-teal" />
                  {room.location}
                </span>
                <span className="flex items-center gap-1.5 font-medium text-corporate-charcoal">
                  <Users className="w-3.5 h-3.5 text-corporate-teal" />
                  Capacity: {room.capacity} Persons
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQrModal(true)}
                title="Preview room QR code"
              >
                <QrCode className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">QR Code</span>
              </Button>

              <Link href={`/room/${room.id}/print`} target="_blank">
                <Button variant="outline" size="sm" title="Printable A4 Sign">
                  <Printer className="w-3.5 h-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Print Sign</span>
                </Button>
              </Link>

              {isFreeNow && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleBookNext30Min}
                  className="bg-corporate-green hover:bg-emerald-700 text-white"
                >
                  <Zap className="w-3.5 h-3.5 mr-1" />
                  Book Now
                </Button>
              )}
            </div>
          </div>

          {/* Amenities Tags */}
          {room.amenities && room.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-corporate-hairline">
              {room.amenities.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] bg-slate-100 text-slate-700 border border-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Status Banner */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div
          className={`p-4 sm:p-5 rounded-sm border shadow-sm transition-all ${
            isFreeNow
              ? 'bg-emerald-50/80 border-emerald-300 text-corporate-green'
              : isOccupied
              ? 'bg-rose-50/80 border-rose-300 text-corporate-red'
              : 'bg-slate-100 border-slate-300 text-slate-700'
          }`}
        >
          <div className="flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isFreeNow && (
                <div className="w-4 h-4 rounded-full bg-corporate-green ring-4 ring-emerald-200 animate-pulse flex-shrink-0" />
              )}
              {isOccupied && (
                <div className="w-4 h-4 rounded-full bg-corporate-red ring-4 ring-rose-200 animate-pulse flex-shrink-0" />
              )}
              {isBlocked && (
                <ShieldAlert className="w-5 h-5 text-slate-600 flex-shrink-0" />
              )}

              <div>
                <h3 className="text-base sm:text-lg font-bold tracking-tight">
                  {status.bannerText}
                </h3>
                {status.nextMeetingSummary && (
                  <p className="text-xs text-slate-600 mt-0.5">
                    {status.nextMeetingSummary}
                  </p>
                )}
              </div>
            </div>

            {isFreeNow && (
              <Button
                size="sm"
                variant="primary"
                onClick={handleBookNext30Min}
                className="bg-corporate-green hover:bg-emerald-700 shadow-xs flex-shrink-0"
              >
                Reserve Slot
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Date Picker Strip */}
      <div className="mt-6">
        <DatePickerStrip
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          maxDays={30}
        />
      </div>

      {/* Timeline Section */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-corporate-navy uppercase tracking-wider">
              Today&apos;s Schedule
            </h2>
            <p className="text-xs text-slate-500">
              Dubai Time (08:00 – 20:00) • Tap any free slot to reserve
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-corporate-charcoal">
              <span className="w-3 h-3 rounded-xs bg-emerald-500" />
              Free
            </span>
            <span className="flex items-center gap-1.5 text-corporate-charcoal">
              <span className="w-3 h-3 rounded-xs bg-corporate-red" />
              Booked
            </span>
            <span className="flex items-center gap-1.5 text-corporate-charcoal">
              <span className="w-3 h-3 rounded-xs bg-slate-400" />
              Unavailable
            </span>
          </div>
        </div>

        <VerticalTimeline
          slots={slots}
          selectedDate={selectedDate}
          onSlotClick={handleSlotClick}
        />
      </main>

      {/* Booking Sheet Modal */}
      <BookingSheet
        isOpen={isBookingSheetOpen}
        onClose={() => setIsBookingSheetOpen(false)}
        room={room}
        selectedDate={selectedDate}
        initialSlot={selectedSlot}
        onBookingSuccess={() => fetchSchedule(selectedDate)}
      />

      {/* QR Code Quick Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-corporate-charcoal/60 backdrop-blur-xs"
            onClick={() => setShowQrModal(false)}
          />
          <div className="relative z-10 w-full max-w-sm bg-white rounded-sm shadow-xl border border-corporate-hairline p-6 text-center animate-slide-up">
            <h3 className="text-base font-bold text-corporate-navy mb-1">{room.name} QR Code</h3>
            <p className="text-xs text-slate-500 mb-4">
              Permanent direct link: http://192.168.50.143/room/{room.id}
            </p>
            <div className="flex justify-center p-4 bg-white border border-corporate-hairline rounded-sm mb-4">
              <img src={qrDataUrl} alt={`${room.name} QR Code`} className="w-48 h-48" />
            </div>
            <div className="flex items-center justify-center gap-2">
              <a href={qrDataUrl} download={`${room.name.replace(/\s+/g, '_')}_QR.png`}>
                <Button size="sm" variant="outline">
                  Download PNG
                </Button>
              </a>
              <Link href={`/room/${room.id}/print`} target="_blank">
                <Button size="sm" variant="primary">
                  Print A4 Sign
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
