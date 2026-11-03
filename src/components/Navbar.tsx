'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, Shield, LayoutGrid } from 'lucide-react';
import { formatInDubai } from '@/lib/timezone';

export function Navbar() {
  const pathname = usePathname();
  const [dubaiTime, setDubaiTime] = React.useState<string>('');
  const [isLive, setIsLive] = React.useState<boolean>(true);

  React.useEffect(() => {
    const updateTime = () => {
      setDubaiTime(formatInDubai(new Date(), 'HH:mm:ss'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to SSE to reflect live status
  React.useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime');
      es.onopen = () => setIsLive(true);
      es.onerror = () => setIsLive(false);
    } catch (e) {
      setIsLive(false);
    }
    return () => {
      if (es) es.close();
    };
  }, []);

  const isDisplayRoute = pathname.startsWith('/display');
  const isPrintRoute = pathname.endsWith('/print');

  if (isDisplayRoute || isPrintRoute) {
    return null; // Fullscreen tablet or print view
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-corporate-hairline bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* App Title strictly 'Meeting Room Booking' - NO company name, NO company logo */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-3 text-corporate-navy hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 rounded-sm bg-corporate-navy flex items-center justify-center text-white font-bold text-sm tracking-wider">
              MR
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-corporate-navy block leading-tight">
                Meeting Room Booking
              </span>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
                Internal Network System
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 border-l border-corporate-hairline pl-6">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
                pathname === '/'
                  ? 'bg-corporate-offwhite text-corporate-navy font-semibold'
                  : 'text-slate-600 hover:text-corporate-navy hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5" />
                All Rooms
              </span>
            </Link>
          </nav>
        </div>

        {/* Live Dubai Clock & Status */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-corporate-offwhite rounded-sm border border-corporate-hairline text-xs font-mono text-corporate-charcoal">
            <Clock className="w-3.5 h-3.5 text-corporate-teal" />
            <span>{dubaiTime || '--:--:--'}</span>
            <span className="text-[10px] text-slate-400">GST (UTC+4)</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
              title={isLive ? 'Realtime sync active' : 'Connecting to realtime service...'}
            />
            <span className="hidden sm:inline text-[11px] font-medium text-slate-500">
              {isLive ? 'Live' : 'Syncing'}
            </span>
          </div>

          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-corporate-hairline bg-corporate-offwhite hover:bg-slate-200 text-corporate-navy text-xs font-medium transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-corporate-teal" />
            <span className="hidden sm:inline">Receptionist Console</span>
            <span className="sm:hidden">Admin</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
