'use client';

import * as React from 'react';
import Link from 'next/link';
import { Room, RoomStatusInfo } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, MapPin, ArrowRight, CheckCircle2, Clock, ShieldAlert, Sparkles, QrCode } from 'lucide-react';

interface RoomWithStatus extends Room {
  currentStatus: RoomStatusInfo;
}

interface HomeClientViewProps {
  initialRooms: RoomWithStatus[];
}

export function HomeClientView({ initialRooms }: HomeClientViewProps) {
  const [rooms, setRooms] = React.useState<RoomWithStatus[]>(initialRooms);
  const [search, setSearch] = React.useState('');

  const fetchRooms = React.useCallback(async () => {
    try {
      const res = await fetch('/api/rooms?withStatus=true');
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms);
      }
    } catch (e) {
      console.error('Failed to update rooms overview', e);
    }
  }, []);

  // Listen to realtime SSE updates
  React.useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime');
      es.addEventListener('bookings', () => fetchRooms());
      es.addEventListener('blocked_slots', () => fetchRooms());
      es.addEventListener('rooms', () => fetchRooms());
    } catch (e) {
      // Ignored
    }
    return () => {
      if (es) es.close();
    };
  }, [fetchRooms]);

  const filtered = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.location.toLowerCase().includes(search.toLowerCase()) ||
      r.amenities.some((a) => a.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-corporate-offwhite pb-20">
      {/* Hero Banner with Deep Corporate Tones */}
      <section className="bg-corporate-navy text-white py-12 border-b border-corporate-hairline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-300">
              Corporate Facility Management
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 text-white">
              Meeting Room Booking
            </h1>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Scan the QR code outside any meeting room or select a room below to view live
              availability and reserve a time slot instantly.
            </p>
          </div>
        </div>
      </section>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-corporate-navy">Meeting Rooms Directory</h2>
            <p className="text-xs text-slate-500">
              Displaying all {rooms.length} meeting facilities on the internal network
            </p>
          </div>
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Search rooms, amenities, floors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-sm border border-corporate-hairline bg-white text-corporate-charcoal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-corporate-teal"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((room) => {
            const isFree = room.currentStatus?.state === 'available';
            const isOccupied = room.currentStatus?.state === 'occupied';
            const isBlocked = room.currentStatus?.state === 'blocked';

            return (
              <div
                key={room.id}
                className="bg-white rounded-sm border border-corporate-hairline shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-corporate-navy">{room.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-corporate-teal flex-shrink-0" />
                        {room.location}
                      </p>
                    </div>

                    <Badge
                      variant={isFree ? 'available' : isOccupied ? 'occupied' : 'unavailable'}
                    >
                      {isFree && <CheckCircle2 className="w-3 h-3 text-corporate-green" />}
                      {isOccupied && <Clock className="w-3 h-3 text-corporate-red" />}
                      {isBlocked && <ShieldAlert className="w-3 h-3 text-slate-500" />}
                      <span>{isFree ? 'Available' : isOccupied ? 'Occupied' : 'Unavailable'}</span>
                    </Badge>
                  </div>

                  {/* Status Banner */}
                  <div
                    className={`p-3 rounded-xs text-xs mb-4 border ${
                      isFree
                        ? 'bg-emerald-50/70 border-emerald-200 text-corporate-green font-medium'
                        : isOccupied
                        ? 'bg-rose-50/70 border-rose-200 text-corporate-red'
                        : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    <p className="font-semibold">{room.currentStatus?.bannerText}</p>
                    {room.currentStatus?.nextMeetingSummary && (
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {room.currentStatus.nextMeetingSummary}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Users className="w-3.5 h-3.5 text-corporate-teal flex-shrink-0" />
                      <span>Capacity: {room.capacity} Persons</span>
                    </div>

                    {room.amenities && room.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2">
                        {room.amenities.map((amenity, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-xs text-[10px] bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            {amenity}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-corporate-offwhite/50 border-t border-corporate-hairline flex items-center justify-between gap-2">
                  <Link href={`/room/${room.id}`} className="w-full">
                    <Button variant="primary" size="sm" className="w-full">
                      <span>View Schedule & Book</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
