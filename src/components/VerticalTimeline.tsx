'use client';

import * as React from 'react';
import { TimelineSlot, SlotState } from '@/types';
import { getDubaiNowLinePercentage, formatInDubai } from '@/lib/timezone';
import { Plus, User, Clock, AlertTriangle, Lock } from 'lucide-react';

interface VerticalTimelineProps {
  slots: TimelineSlot[];
  selectedDate: string;
  onSlotClick: (slot: TimelineSlot) => void;
  privacyMode?: boolean;
}

export function VerticalTimeline({
  slots,
  selectedDate,
  onSlotClick,
  privacyMode = false,
}: VerticalTimelineProps) {
  const [nowPercent, setNowPercent] = React.useState<number | null>(null);

  React.useEffect(() => {
    const updateNow = () => {
      setNowPercent(getDubaiNowLinePercentage(selectedDate));
    };
    updateNow();
    const timer = setInterval(updateNow, 30000); // refresh now line every 30s
    return () => clearInterval(timer);
  }, [selectedDate]);

  return (
    <div className="relative bg-white border border-corporate-hairline rounded-sm shadow-sm overflow-hidden">
      {/* Live 'Now' line if viewing today */}
      {nowPercent !== null && (
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none flex items-center transition-all duration-500"
          style={{ top: `${nowPercent}%` }}
        >
          <div className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-corporate-red ring-4 ring-rose-200 animate-pulse -ml-1.5" />
            <span className="bg-corporate-red text-white text-[9px] font-bold px-1.5 py-0.5 rounded-xs ml-1 shadow-sm uppercase tracking-wider">
              Now ({formatInDubai(new Date(), 'HH:mm')})
            </span>
          </div>
          <div className="flex-1 h-[2px] bg-corporate-red/80 ml-2" />
        </div>
      )}

      {/* Slots List */}
      <div className="divide-y divide-corporate-hairline">
        {slots.map((slot) => {
          const isFree = slot.state === 'free';
          const isBooked = slot.state === 'booked';
          const isBlocked = slot.state === 'blocked';
          const isPast = slot.state === 'past';

          return (
            <div
              key={slot.slotIndex}
              onClick={() => {
                if (isFree) {
                  onSlotClick(slot);
                }
              }}
              className={`relative flex items-center justify-between p-3 sm:p-4 transition-colors min-h-[56px] select-none ${
                isFree
                  ? 'bg-emerald-50/20 hover:bg-emerald-50/70 cursor-pointer border-l-4 border-l-corporate-green'
                  : isBooked
                  ? 'bg-rose-50/40 border-l-4 border-l-corporate-red'
                  : isBlocked
                  ? 'bg-slate-100/70 border-l-4 border-l-slate-400'
                  : 'bg-slate-50/50 opacity-60 border-l-4 border-l-slate-200'
              }`}
            >
              {/* Left: Time Label */}
              <div className="flex flex-col w-20 sm:w-24 flex-shrink-0">
                <span className="text-xs sm:text-sm font-bold font-mono text-corporate-charcoal">
                  {slot.startLabel}
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 font-mono">
                  {slot.endLabel}
                </span>
              </div>

              {/* Middle: Content */}
              <div className="flex-1 px-3 sm:px-6">
                {isFree && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-corporate-green uppercase tracking-wide">
                      Available
                    </span>
                    <span className="hidden sm:inline text-xs text-slate-400">• Tap to reserve</span>
                  </div>
                )}

                {isBooked && (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-corporate-navy line-clamp-1">
                        {privacyMode ? 'Booked' : slot.booking?.title || 'Reserved'}
                      </span>
                    </div>
                    {!privacyMode && slot.booking?.organizer_name && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{slot.booking.organizer_name}</span>
                      </div>
                    )}
                  </div>
                )}

                {isBlocked && (
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                        Unavailable
                      </span>
                      {slot.blockedSlot?.title && (
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {slot.blockedSlot.title}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {isPast && (
                  <span className="text-xs text-slate-400 italic">Past Time Window</span>
                )}
              </div>

              {/* Right: Action or Badge */}
              <div className="flex-shrink-0">
                {isFree && (
                  <button
                    type="button"
                    data-book-slot="true"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-corporate-green text-white text-xs font-medium hover:bg-emerald-700 transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Book</span>
                  </button>
                )}

                {isBooked && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-corporate-red border border-rose-200 uppercase tracking-wider">
                    Occupied
                  </span>
                )}

                {isBlocked && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-700 border border-slate-300 uppercase tracking-wider">
                    Blocked
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
