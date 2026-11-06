'use client';

import * as React from 'react';
import { Room, RoomStatusInfo, Booking, BlockedSlot } from '@/types';
import { formatInDubai, computeRoomStatus } from '@/lib/timezone';
import { MapPin } from 'lucide-react';

interface LobbyClientViewProps {
  initialRooms: Room[];
  initialBookings: Booking[];
  initialBlockedSlots: BlockedSlot[];
  directoryQrDataUrl: string;
}

export function LobbyClientView({
  initialRooms,
  initialBookings,
  initialBlockedSlots,
  directoryQrDataUrl,
}: LobbyClientViewProps) {
  const [dubaiTime, setDubaiTime] = React.useState('');
  const [dubaiDate, setDubaiDate] = React.useState('');
  const [rooms, setRooms] = React.useState<Room[]>(initialRooms);
  const [bookings, setBookings] = React.useState<Booking[]>(initialBookings);
  const [blockedSlots, setBlockedSlots] = React.useState<BlockedSlot[]>(initialBlockedSlots);
  const [isOnline, setIsOnline] = React.useState(true);

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setDubaiTime(formatInDubai(now, 'HH:mm:ss'));
      setDubaiDate(formatInDubai(now, 'EEEE, d MMMM yyyy'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const refreshData = React.useCallback(async () => {
    try {
      const todayStr = formatInDubai(new Date(), 'yyyy-MM-dd');
      const [rRes, bRes, blRes] = await Promise.all([
        fetch('/api/rooms'),
        fetch(`/api/bookings?date=${todayStr}`),
        fetch(`/api/blocks?date=${todayStr}`),
      ]);
      if (rRes.ok) setRooms((await rRes.json()).rooms || []);
      if (bRes.ok) setBookings((await bRes.json()).bookings || []);
      if (blRes.ok) setBlockedSlots((await blRes.json()).blocks || []);
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    }
  }, []);

  React.useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime');
      es.addEventListener('bookings', () => refreshData());
      es.addEventListener('blocked_slots', () => refreshData());
      es.addEventListener('rooms', () => refreshData());
      es.onopen = () => setIsOnline(true);
      es.onerror = () => setIsOnline(false);
    } catch {
      setIsOnline(false);
    }
    const timer = setInterval(refreshData, 30000);
    return () => {
      if (es) es.close();
      clearInterval(timer);
    };
  }, [refreshData]);

  return (
    <div className="fixed inset-0 h-screen max-h-screen w-screen max-w-screen overflow-hidden bg-[#0B1F3A] text-white select-none flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Subtle Offline / Reconnecting Banner (Only visible when offline) */}
      {!isOnline && (
        <div className="absolute top-3 right-3 z-50 flex items-center gap-2 px-3 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-semibold backdrop-blur-xs">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Reconnecting...
        </div>
      )}

      {/* Top Banner */}
      <header className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
            Meeting Room Booking
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">Live facility availability overview</p>
        </div>

        <div className="text-right">
          <div className="text-2xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-white">
            {dubaiTime || '--:--:--'}
          </div>
          <div className="text-[11px] sm:text-xs font-medium text-slate-300 mt-0.5 uppercase tracking-wider">
            {dubaiDate}
          </div>
        </div>
      </header>

      {/* Main Grid: All 5 Rooms + Lobby QR Code */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 my-auto min-h-0 flex-1 py-3 items-stretch">
        {rooms.map((room) => {
          const rBookings = bookings.filter((b) => b.room_id === room.id);
          const rBlocked = blockedSlots.filter((b) => b.room_id === null || b.room_id === room.id);
          const status = computeRoomStatus(rBookings, rBlocked);

          const isFree = status.state === 'available';
          const isOccupied = status.state === 'occupied';

          return (
            <div
              key={room.id}
              className={`p-4 sm:p-5 rounded-sm border-2 transition-all flex flex-col justify-between ${
                isFree
                  ? 'bg-emerald-950/60 border-emerald-500/50'
                  : isOccupied
                  ? 'bg-rose-950/60 border-rose-500/50'
                  : 'bg-slate-900/60 border-slate-600/50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-white">{room.name}</h3>
                    <p className="text-[11px] sm:text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3 h-3 text-teal-300" />
                      {room.location} • Capacity: {room.capacity}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border shrink-0 ${
                      isFree
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : isOccupied
                        ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                        : 'bg-slate-500/20 text-slate-300 border-slate-400/40'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isFree ? 'bg-emerald-400 animate-pulse' : isOccupied ? 'bg-rose-400 animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                    {isFree ? 'Available' : isOccupied ? 'Occupied' : 'Unavailable'}
                  </span>
                </div>

                <div className="mt-3 p-2.5 sm:p-3 bg-white/5 rounded-xs border border-white/10">
                  <p className="text-xs sm:text-sm font-bold text-white uppercase">{status.bannerText}</p>
                  {status.nextMeetingSummary && (
                    <p className="text-[11px] text-slate-300 mt-0.5">{status.nextMeetingSummary}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-white/10 text-[11px] text-slate-300 flex items-center justify-between">
                <span>Scan QR outside room to reserve</span>
              </div>
            </div>
          );
        })}

        {/* 6th Slot: Central Lobby QR */}
        <div className="p-4 sm:p-5 rounded-sm border-2 border-white/20 bg-white/5 flex flex-col items-center justify-center text-center">
          <div className="p-2.5 bg-white rounded-sm shadow-md inline-block">
            <img src={directoryQrDataUrl} alt="Lobby QR" className="w-24 h-24 sm:w-28 sm:h-28 object-contain" />
          </div>
          <h4 className="text-xs sm:text-sm font-black text-white mt-3 uppercase tracking-tight">
            Scan to Browse All Rooms
          </h4>
          <p className="text-[11px] text-slate-300 mt-1 max-w-xs">
            Open the full room directory and book any available room from your phone.
          </p>
        </div>
      </div>
    </div>
  );
}
