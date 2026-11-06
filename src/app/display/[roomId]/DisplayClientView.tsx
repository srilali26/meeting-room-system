'use client';

import * as React from 'react';
import { Room, RoomStatusInfo, Booking, BlockedSlot } from '@/types';
import { formatInDubai, computeRoomStatus, isOverlappingDubaiDay } from '@/lib/timezone';
import { Clock, Users, MapPin } from 'lucide-react';
import { parseISO, isAfter } from 'date-fns';

interface DisplayClientViewProps {
  room: Room;
  qrDataUrl: string;
  initialBookings: Booking[];
  initialBlockedSlots: BlockedSlot[];
  displayToken?: string;
}

export function DisplayClientView({
  room,
  qrDataUrl,
  initialBookings,
  initialBlockedSlots,
  displayToken = `token-screen-room-${room.id}`,
}: DisplayClientViewProps) {
  const [dubaiTime, setDubaiTime] = React.useState<string>('');
  const [dubaiDate, setDubaiDate] = React.useState<string>('');
  const [bookings, setBookings] = React.useState<Booking[]>(initialBookings);
  const [blockedSlots, setBlockedSlots] = React.useState<BlockedSlot[]>(initialBlockedSlots);
  const [isOnline, setIsOnline] = React.useState(true);

  // Dubai Live Clock
  React.useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setDubaiTime(formatInDubai(now, 'HH:mm:ss'));
      setDubaiDate(formatInDubai(now, 'EEEE, d MMMM yyyy'));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Wake Lock API (prevents tablet screen timeout)
  React.useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // Wake lock may not be allowed in all contexts
      }
    };
    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  // 3:00 AM Daily Refresh Routine
  React.useEffect(() => {
    const checkNightlyReload = () => {
      const nowDubai = formatInDubai(new Date(), 'HH:mm');
      if (nowDubai === '03:00') {
        window.location.reload();
      }
    };
    const timer = setInterval(checkNightlyReload, 40000);
    return () => clearInterval(timer);
  }, []);

  // Fetch updated schedule strictly for today in Dubai
  const refreshRoomData = React.useCallback(async () => {
    try {
      const todayStr = formatInDubai(new Date(), 'yyyy-MM-dd');
      const [rRes, bRes, blRes] = await Promise.all([
        fetch(`/api/rooms/${room.id}?date=${todayStr}`),
        fetch(`/api/bookings?roomId=${room.id}&date=${todayStr}`),
        fetch(`/api/blocks?roomId=${room.id}&date=${todayStr}`),
      ]);

      if (bRes.ok) {
        const bData = await bRes.json();
        setBookings(bData.bookings || []);
      }
      if (blRes.ok) {
        const blData = await blRes.json();
        setBlockedSlots(blData.blocks || []);
      }
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    }
  }, [room.id]);

  // Real-time SSE listener + 30s Polling Fallback + Silent Background Heartbeat
  React.useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime');
      es.addEventListener('bookings', () => refreshRoomData());
      es.addEventListener('blocked_slots', () => refreshRoomData());
      es.addEventListener('rooms', () => refreshRoomData());
      es.onopen = () => setIsOnline(true);
      es.onerror = () => setIsOnline(false);
    } catch {
      setIsOnline(false);
    }

    // Fallback polling every 30 seconds
    const fallbackTimer = setInterval(refreshRoomData, 30000);

    // Silent background heartbeat to keep admin console Online/Offline accurate
    const sendHeartbeat = async () => {
      try {
        const res = await fetch('/api/screens/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: displayToken }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.reload_requested) {
            window.location.reload();
          }
          setIsOnline(true);
        }
      } catch {
        setIsOnline(false);
      }
    };

    sendHeartbeat();
    const heartbeatTimer = setInterval(sendHeartbeat, 45000);

    return () => {
      if (es) es.close();
      clearInterval(fallbackTimer);
      clearInterval(heartbeatTimer);
    };
  }, [refreshRoomData, room.id]);

  const currentStatus = computeRoomStatus(bookings, blockedSlots);
  const isFree = currentStatus.state === 'available';
  const isOccupied = currentStatus.state === 'occupied';

  // Next 3 meetings for TODAY in Dubai
  const now = new Date();
  const todayDubaiStr = formatInDubai(now, 'yyyy-MM-dd');
  const nextMeetings = bookings
    .filter(
      (b) =>
        b.status === 'confirmed' &&
        isAfter(parseISO(b.end_time), now) &&
        isOverlappingDubaiDay(b.start_time, b.end_time, todayDubaiStr)
    )
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 3);

  return (
    <div className="fixed inset-0 h-screen max-h-screen w-screen max-w-screen overflow-hidden bg-[#0B1F3A] text-white select-none flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Subtle Offline / Reconnecting Banner (Only visible when offline) */}
      {!isOnline && (
        <div className="absolute top-3 right-3 z-50 flex items-center gap-2 px-3 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-semibold backdrop-blur-xs">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Reconnecting...
        </div>
      )}

      {/* Top Header: Room Name, Location & Live Clock */}
      <header className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
            {room.name}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-xs sm:text-sm text-slate-300">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-teal-300" />
              {room.location}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-teal-300" />
              Capacity: {room.capacity} Persons
            </span>
          </div>
        </div>

        {/* Live Dubai Clock & Date */}
        <div className="text-right">
          <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-white">
            {dubaiTime || '--:--:--'}
          </div>
          <div className="text-[11px] sm:text-xs font-medium text-slate-300 mt-0.5 uppercase tracking-wider">
            {dubaiDate}
          </div>
        </div>
      </header>

      {/* Center Hero: Status Banner, Next 3 Meetings & QR Code */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 my-auto items-stretch min-h-0 flex-1 py-3">
        {/* Left / Main Section: Status Banner & Next Meetings (8 cols) */}
        <div className="lg:col-span-8 flex flex-col justify-between gap-3 min-h-0">
          {/* Main Status Banner */}
          <div
            className={`p-5 sm:p-6 lg:p-8 rounded-sm border-2 shadow-xl flex flex-col justify-center flex-1 ${
              isFree
                ? 'bg-emerald-950/80 border-emerald-400 text-emerald-100'
                : isOccupied
                ? 'bg-rose-950/80 border-rose-400 text-rose-100'
                : 'bg-slate-900/80 border-slate-400 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-3 mb-1">
              <span
                className={`w-3.5 h-3.5 rounded-full ${
                  isFree
                    ? 'bg-emerald-400 ring-4 ring-emerald-500/30 animate-pulse'
                    : isOccupied
                    ? 'bg-rose-500 ring-4 ring-rose-500/30 animate-pulse'
                    : 'bg-slate-400'
                }`}
              />
              <span className="text-xs sm:text-sm font-black tracking-widest uppercase">
                {isFree ? 'AVAILABLE NOW' : isOccupied ? 'OCCUPIED' : 'UNAVAILABLE'}
              </span>
            </div>

            <div className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1 uppercase leading-tight">
              {currentStatus.bannerText}
            </div>

            {currentStatus.nextMeetingSummary && (
              <p className="text-sm sm:text-base text-slate-200 mt-2 font-medium">
                {currentStatus.nextMeetingSummary}
              </p>
            )}
          </div>

          {/* Next 3 Meetings Today */}
          <div className="bg-white/5 border border-white/10 rounded-sm p-4 sm:p-5 shrink-0">
            <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-slate-300 mb-2.5 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-teal-300" />
              Upcoming Meetings Today
            </h3>

            {nextMeetings.length === 0 ? (
              <p className="text-xs sm:text-sm text-slate-300 italic py-1">
                No further meetings scheduled for today. Room is available.
              </p>
            ) : (
              <div className="divide-y divide-white/10">
                {nextMeetings.map((m, idx) => (
                  <div key={m.id} className="py-2 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-xs bg-teal-900/60 text-teal-300 flex items-center justify-center font-bold text-[11px]">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-white line-clamp-1">{m.title}</div>
                        <div className="text-[11px] text-slate-300">Organized by {m.organizer_name}</div>
                      </div>
                    </div>

                    <div className="text-right font-mono text-xs sm:text-sm font-bold text-teal-300">
                      {formatInDubai(m.start_time, 'HH:mm')} – {formatInDubai(m.end_time, 'HH:mm')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Large QR Code with Caption (4 cols) */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-sm p-5 sm:p-6 text-center shadow-lg">
          <div className="p-3 bg-white rounded-sm shadow-xl inline-block border-2 border-white">
            <img
              src={qrDataUrl}
              alt="Scan QR"
              className="w-40 h-40 sm:w-48 sm:h-48 lg:w-56 lg:h-56 object-contain"
            />
          </div>

          <h3 className="text-base sm:text-lg font-black text-white mt-4 uppercase tracking-tight">
            Scan with Phone to Book
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-300 mt-1 max-w-xs leading-relaxed">
            Scan QR code to view live timeline and reserve this room instantly.
          </p>
        </div>
      </div>
    </div>
  );
}
