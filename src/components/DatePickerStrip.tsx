'use client';

import * as React from 'react';
import { addDays, parseISO } from 'date-fns';
import { formatInDubai } from '@/lib/timezone';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerStripProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  maxDays?: number;
}

export function DatePickerStrip({ selectedDate, onSelectDate, maxDays = 30 }: DatePickerStripProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const todayDubaiStr = formatInDubai(new Date(), 'yyyy-MM-dd');

  // Generate 30 days
  const days = React.useMemo(() => {
    const list: { dateStr: string; dayName: string; dayNum: string; monthName: string; isToday: boolean }[] = [];
    const base = new Date();
    for (let i = 0; i < maxDays; i++) {
      const d = addDays(base, i);
      const dateStr = formatInDubai(d, 'yyyy-MM-dd');
      list.push({
        dateStr,
        dayName: i === 0 ? 'Today' : formatInDubai(d, 'EEE'),
        dayNum: formatInDubai(d, 'd'),
        monthName: formatInDubai(d, 'MMM'),
        isToday: i === 0,
      });
    }
    return list;
  }, [maxDays]);

  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const offset = direction === 'left' ? -240 : 240;
      containerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full bg-white border-y border-corporate-hairline py-3">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-corporate-charcoal">
            <CalendarIcon className="w-3.5 h-3.5 text-corporate-teal" />
            <span>Select Date</span>
            {selectedDate !== todayDubaiStr && (
              <button
                onClick={() => onSelectDate(todayDubaiStr)}
                className="ml-2 text-[11px] lowercase tracking-normal px-2 py-0.5 rounded-sm bg-corporate-offwhite border border-corporate-hairline text-corporate-teal hover:underline font-normal"
              >
                jump to today
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => scroll('left')}
              className="p-1 rounded-sm border border-corporate-hairline hover:bg-corporate-offwhite text-slate-500 hover:text-corporate-navy"
              aria-label="Scroll dates left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-1 rounded-sm border border-corporate-hairline hover:bg-corporate-offwhite text-slate-500 hover:text-corporate-navy"
              aria-label="Scroll dates right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 scroll-smooth"
        >
          {days.map((item) => {
            const isSelected = item.dateStr === selectedDate;
            return (
              <button
                key={item.dateStr}
                onClick={() => onSelectDate(item.dateStr)}
                className={`flex-shrink-0 flex flex-col items-center justify-center w-16 py-2 rounded-sm border transition-all text-center ${
                  isSelected
                    ? 'bg-corporate-navy text-white border-corporate-navy shadow-sm'
                    : 'bg-white hover:bg-corporate-offwhite text-corporate-charcoal border-corporate-hairline'
                }`}
              >
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isSelected ? 'text-teal-200' : item.isToday ? 'text-corporate-teal font-extrabold' : 'text-slate-400'
                  }`}
                >
                  {item.dayName}
                </span>
                <span className="text-lg font-bold leading-none my-1">{item.dayNum}</span>
                <span className={`text-[10px] ${isSelected ? 'text-slate-200' : 'text-slate-400'}`}>
                  {item.monthName}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
