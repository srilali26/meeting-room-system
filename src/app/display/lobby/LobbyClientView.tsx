'use client';

import * as React from 'react';
import { Room, RoomStatusInfo, Booking, BlockedSlot } from '@/types';
import { formatInDubai, computeRoomStatus } from '@/lib/timezone';
import { Clock, MapPin, Users, CheckCircle2, QrCode } from 'lucide-react';

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
      const [rRes, bRes, blRes] = await Promise.all([
        fetch('/api/rooms'),
        fetch('/api/bookings'),
        fetch('/api/blocks'),
      ]);
      if (rRes.ok) setRooms((await rRes.json()).rooms);
      if (bRes.ok) setBookings((await bRes.json()).bookings);
      if (blRes.ok) setBlockedSlots((await blRes.json()).blocks);
    } catch (e) {
      // Ignored
    }
  }, []);

  React.useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime');
      es.addEventListener('bookings', () => refreshData());
      es.addEventListener('blocked_slots', () => refreshData());
      es.addEventListener('rooms', () => refreshData());
    } catch (e) {
      // Ignored
    }
    const timer = setInterval(refreshData, 30000);
    return () => {
      if (es) es.close();
      clearInterval(timer);
    };
  }, [refreshData]);

  return (
    <div className="fixed inset-0 bg-[#0B1F3A] text-white select-none overflow-hidden flex flex-col justify-between p-8 sm:p-12">
      {/* Top Banner */}
      <header className="flex items-center justify-between border-b border-white/10 pb-6">
        <div>
          <span className="text-xs font-bold tracking-[0.25em] text-teal-300 uppercase block">
            Reception Overview Board
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white mt-1">
            Meeting Room Booking
          </h1>
          <p className="text-xs text-slate-300 mt-1">Live status of all corporate meeting facilities</p>
        </div>

        <div className="text-right">
          <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-white">
            {dubaiTime || '--:--:--'}
          </div>
          <div className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">
            {dubaiDate} • Dubai (UTC+4)
          </div>
        </div>
      </header>

      {/* Main Grid: All 5 Rooms + Lobby QR Code */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-auto">
        {rooms.map((room) => {
          const rBookings = bookings.filter((b) => b.room_id === room.id);
          const rBlocked = blockedSlots.filter((b) => b.room_id === null || b.room_id === room.id);
          const status = computeRoomStatus(rBookings, rBlocked);

          const isFree = status.state === 'available';
          const isOccupied = status.state === 'occupied';

          return (
            <div
              key={room.id}
              className={`p-6 rounded-sm border-2 transition-all flex flex-col justify-between ${
                isFree
                  ? 'bg-emerald-950/60 border-emerald-500/50'
                  : isOccupied
                  ? 'bg-rose-950/60 border-rose-500/50'
                  : 'bg-slate-900/60 border-slate-600/50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-white">{room.name}</h3>
                    <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-teal-300" />
                      {room.location} • Capacity: {room.capacity}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                      isFree
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : isOccupied
                        ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                        : 'bg-slate-500/20 text-slate-300 border-slate-400/40'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isFree ? 'bg-emerald-400 animate-pulse' : isOccupied ? 'bg-rose-400 animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                    {isFree ? 'Available' : isOccupied ? 'Occupied' : 'Unavailable'}
                  </span>
                </div>

                <div className="mt-4 p-3 bg-white/5 rounded-xs border border-white/10">
                  <p className="text-base font-bold text-white uppercase">{status.bannerText}</p>
                  {status.nextMeetingSummary && (
                    <p className="text-xs text-slate-300 mt-1">{status.nextMeetingSummary}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 text-[11px] text-slate-400 font-mono flex items-center justify-between">
                <span>Scan QR outside room to reserve</span>
                <span>http://192.168.50.143</span>
              </div>
            </div>
          );
        })}

        {/* 6th Slot: Central Lobby QR */}
        <div className="p-6 rounded-sm border-2 border-white/20 bg-white/5 flex flex-col items-center justify-center text-center">
          <div className="p-3 bg-white rounded-sm shadow-md inline-block">
            <img src={directoryQrDataUrl} alt="Lobby QR" className="w-32 h-32 object-contain" />
          </div>
          <h4 className="text-base font-black text-white mt-4 uppercase">
            Scan to Browse All Rooms
          </h4>
          <p className="text-xs text-slate-300 mt-1 max-w-xs">
            Open the full room directory and book any available space from your phone.
          </p>
          <span className="font-mono text-[10px] text-teal-300 mt-2">http://192.168.50.143</span>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="border-t border-white/10 pt-4 flex items-center justify-between text-xs text-slate-400">
        <div>Meeting Room Booking • Lobby Overview Screen</div>
        <div className="font-mono">Windows Server 192.168.50.143 • Internal Network Only</div>
      </footer>
    </div>
  );
}
