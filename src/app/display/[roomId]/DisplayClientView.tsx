'use client';

import * as React from 'react';
import { Room, RoomStatusInfo, Booking, BlockedSlot } from '@/types';
import { formatInDubai, computeRoomStatus } from '@/lib/timezone';
import { Clock, Users, MapPin, CheckCircle2, ShieldAlert, Wifi, QrCode } from 'lucide-react';
import { parseISO, isAfter } from 'date-fns';

interface DisplayClientViewProps {
  room: Room;
  qrDataUrl: string;
  initialBookings: Booking[];
  initialBlockedSlots: BlockedSlot[];
}

export function DisplayClientView({
  room,
  qrDataUrl,
  initialBookings,
  initialBlockedSlots,
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
      } catch (err) {
        // Wake lock may not be allowed in all contexts
      }
    };
    requestWakeLock();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    });

    return () => {
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

  // Fetch updated schedule
  const refreshRoomData = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${room.id}`);
      if (res.ok) {
        const data = await res.json();
        const bRes = await fetch(`/api/bookings?roomId=${room.id}`);
        if (bRes.ok) {
          const bData = await bRes.json();
          setBookings(bData.bookings);
        }
        setIsOnline(true);
      }
    } catch (e) {
      setIsOnline(false);
    }
  }, [room.id]);

  // Real-time SSE listener + 30s Polling Fallback
  React.useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime');
      es.addEventListener('bookings', () => refreshRoomData());
      es.addEventListener('blocked_slots', () => refreshRoomData());
      es.addEventListener('rooms', () => refreshRoomData());
      es.onopen = () => setIsOnline(true);
      es.onerror = () => setIsOnline(false);
    } catch (e) {
      setIsOnline(false);
    }

    // Fallback polling every 30 seconds
    const fallbackTimer = setInterval(refreshRoomData, 30000);

    // Heartbeat ping
    const heartbeatTimer = setInterval(async () => {
      try {
        const res = await fetch('/api/screens/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: `token-screen-${room.id}` }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.reload_requested) {
            window.location.reload();
          }
        }
      } catch (err) {
        // Heartbeat error
      }
    }, 45000);

    return () => {
      if (es) es.close();
      clearInterval(fallbackTimer);
      clearInterval(heartbeatTimer);
    };
  }, [refreshRoomData, room.id]);

  const currentStatus = computeRoomStatus(bookings, blockedSlots);
  const isFree = currentStatus.state === 'available';
  const isOccupied = currentStatus.state === 'occupied';
  const isBlocked = currentStatus.state === 'blocked';

  // Next 3 meetings
  const now = new Date();
  const nextMeetings = bookings
    .filter((b) => b.status === 'confirmed' && isAfter(parseISO(b.end_time), now))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 3);

  return (
    <div className="fixed inset-0 bg-[#0B1F3A] text-white select-none overflow-hidden flex flex-col justify-between p-8 sm:p-12">
      {/* Top Header: Room Name, Location & Live Clock */}
      <header className="flex items-start justify-between border-b border-white/10 pb-6">
        <div>
          <span className="text-xs sm:text-sm font-bold tracking-[0.25em] text-teal-300 uppercase block">
            Meeting Room System
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mt-1">
            {room.name}
          </h1>
          <div className="flex items-center gap-6 mt-3 text-sm text-slate-300">
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-300" />
              {room.location}
            </span>
            <span>•</span>
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-300" />
              Capacity: {room.capacity} Persons
            </span>
          </div>
        </div>

        {/* Live Dubai Clock */}
        <div className="text-right">
          <div className="text-4xl sm:text-5xl lg:text-6xl font-black font-mono tracking-tight text-white">
            {dubaiTime || '--:--:--'}
          </div>
          <div className="text-xs sm:text-sm font-medium text-slate-400 mt-1 uppercase tracking-wider">
            {dubaiDate} • Dubai (UTC+4)
          </div>
          <div className="flex items-center justify-end gap-1.5 mt-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-[11px] font-mono text-slate-400">
              {isOnline ? 'Realtime Connected' : 'Reconnecting...'}
            </span>
          </div>
        </div>
      </header>

      {/* Center Hero: Status Banner + QR Scan Code */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto items-center">
        {/* Left Column: Huge Status Banner & Next Meetings (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div
            className={`p-8 sm:p-10 rounded-sm border-2 shadow-2xl transition-all ${
              isFree
                ? 'bg-emerald-950/80 border-emerald-400 text-emerald-100'
                : isOccupied
                ? 'bg-rose-950/80 border-rose-400 text-rose-100'
                : 'bg-slate-900/80 border-slate-400 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-4 mb-2">
              <span
                className={`w-4 h-4 rounded-full ${
                  isFree
                    ? 'bg-emerald-400 ring-8 ring-emerald-500/30 animate-pulse'
                    : isOccupied
                    ? 'bg-rose-500 ring-8 ring-rose-500/30 animate-pulse'
                    : 'bg-slate-400'
                }`}
              />
              <span className="text-xs sm:text-sm font-black tracking-widest uppercase">
                {isFree ? 'Status: Free to Use' : isOccupied ? 'Status: Currently In Use' : 'Status: Unavailable'}
              </span>
            </div>

            <div className="text-4xl sm:text-6xl font-black tracking-tight mt-2 uppercase">
              {currentStatus.bannerText}
            </div>

            {currentStatus.nextMeetingSummary && (
              <p className="text-lg text-slate-300 mt-3 font-medium">
                {currentStatus.nextMeetingSummary}
              </p>
            )}
          </div>

          {/* Upcoming Next 3 Meetings */}
          <div className="bg-white/5 border border-white/10 rounded-sm p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-300" />
              Upcoming Meetings Today
            </h3>

            {nextMeetings.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                No further meetings scheduled for today. Room is available.
              </p>
            ) : (
              <div className="divide-y divide-white/10">
                {nextMeetings.map((m, idx) => (
                  <div key={m.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="flex items-center gap-4">
                      <span className="w-6 h-6 rounded-xs bg-teal-900/50 text-teal-300 flex items-center justify-center font-bold text-xs">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-base font-bold text-white">{m.title}</div>
                        <div className="text-xs text-slate-400">Organized by {m.organizer_name}</div>
                      </div>
                    </div>

                    <div className="text-right font-mono text-sm font-bold text-teal-300">
                      {formatInDubai(m.start_time, 'HH:mm')} – {formatInDubai(m.end_time, 'HH:mm')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Prominent QR Code (4 cols) */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-sm p-8 text-center shadow-xl">
          <div className="p-4 bg-white rounded-sm shadow-2xl inline-block border-2 border-white">
            <img
              src={qrDataUrl}
              alt="Scan QR"
              className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
            />
          </div>

          <h3 className="text-xl font-black text-white mt-6 uppercase tracking-tight">
            Scan with Phone to Book
          </h3>
          <p className="text-xs text-slate-300 mt-1 max-w-xs leading-relaxed">
            Directly reserve this room instantly with zero login required.
          </p>
          <div className="mt-4 px-3 py-1 bg-white/10 rounded-xs font-mono text-[11px] text-teal-200">
            http://192.168.50.143/room/{room.id}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="border-t border-white/10 pt-4 flex items-center justify-between text-xs text-slate-400">
        <div>Meeting Room Booking • Dedicated Media Player Display</div>
        <div className="font-mono">Server IP: 192.168.50.143 • Internal Network Only</div>
      </footer>
    </div>
  );
}
