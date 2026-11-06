'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  CalendarCheck2,
  DoorClosed,
  ShieldBan,
  Tv,
  Settings,
  Lock,
  LogOut,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  Search,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Room, Booking, BlockedSlot, DisplayScreen, AppSettings } from '@/types';
import { formatInDubai, isOverlappingDubaiDay, getDubaiNowLinePercentage } from '@/lib/timezone';
import Link from 'next/link';
import { parseISO } from 'date-fns';

interface AdminConsoleProps {
  initialRooms: Room[];
  initialSettings: AppSettings;
}

type TabKey =
  | 'dashboard'
  | 'schedule'
  | 'bookings'
  | 'rooms'
  | 'blocks'
  | 'screens'
  | 'settings';

const HOURS_LIST = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

export function AdminConsoleClient({ initialRooms, initialSettings }: AdminConsoleProps) {
  const router = useRouter();

  // Navigation State (Audit Log and QR Signs removed per Change 2 & 3)
  const [activeTab, setActiveTab] = React.useState<TabKey>('dashboard');

  // Inactivity & PIN Quick-Lock State
  const [isLocked, setIsLocked] = React.useState(false);
  const [pinInput, setPinInput] = React.useState('');
  const [pinError, setPinError] = React.useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = React.useState(false);

  // Data State
  const [rooms, setRooms] = React.useState<Room[]>(initialRooms);
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [blockedSlots, setBlockedSlots] = React.useState<BlockedSlot[]>([]);
  const [screens, setScreens] = React.useState<DisplayScreen[]>([]);
  const [settings, setSettings] = React.useState<AppSettings>(initialSettings);
  const [stats, setStats] = React.useState<any>(null);

  // Today's Schedule Date Navigation (Change 1)
  const [scheduleDate, setScheduleDate] = React.useState<string>(() =>
    formatInDubai(new Date(), 'yyyy-MM-dd')
  );

  // Pagination states for zero page scrolling (Change 4)
  const [bookingPage, setBookingPage] = React.useState(1);
  const [bookingFilterRoom, setBookingFilterRoom] = React.useState<string>('ALL');
  const [bookingSearch, setBookingSearch] = React.useState<string>('');
  const BOOKINGS_PAGE_SIZE = 7;

  const [blocksPage, setBlocksPage] = React.useState(1);
  const BLOCKS_PAGE_SIZE = 6;

  // Modals
  const [showAddRoomModal, setShowAddRoomModal] = React.useState(false);
  const [showEditRoomModal, setShowEditRoomModal] = React.useState(false);
  const [editingRoom, setEditingRoom] = React.useState<Room | null>(null);

  const [showBookOnBehalfModal, setShowBookOnBehalfModal] = React.useState(false);
  const [showEditBookingModal, setShowEditBookingModal] = React.useState(false);
  const [editingBooking, setEditingBooking] = React.useState<Booking | null>(null);

  const [showAddBlockModal, setShowAddBlockModal] = React.useState(false);
  const [showRegisterScreenModal, setShowRegisterScreenModal] = React.useState(false);

  const [showChangePasswordModal, setShowChangePasswordModal] = React.useState(false);
  const [showChangePinModal, setShowChangePinModal] = React.useState(false);

  // Feedback notifications
  const [notification, setNotification] = React.useState<string | null>(null);
  const showNotify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // -------------------------------------------------------------------------
  // Fetching Logic
  // -------------------------------------------------------------------------
  const fetchAllData = React.useCallback(async () => {
    try {
      const [rRes, bRes, blRes, scRes, sRes, stRes] = await Promise.all([
        fetch('/api/rooms?withStatus=true'),
        fetch('/api/bookings'),
        fetch('/api/blocks'),
        fetch('/api/screens'),
        fetch('/api/settings'),
        fetch(`/api/stats?date=${scheduleDate}`),
      ]);

      if (rRes.ok) setRooms((await rRes.json()).rooms || []);
      if (bRes.ok) setBookings((await bRes.json()).bookings || []);
      if (blRes.ok) setBlockedSlots((await blRes.json()).blocks || []);
      if (scRes.ok) setScreens((await scRes.json()).screens || []);
      if (sRes.ok) setSettings((await sRes.json()).settings || initialSettings);
      if (stRes.ok) setStats(await stRes.json());
    } catch (e) {
      console.error('Error fetching admin data', e);
    }
  }, [initialSettings, scheduleDate]);

  // Initial fetch and Realtime SSE listener
  React.useEffect(() => {
    fetchAllData();

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime');
      es.addEventListener('bookings', () => fetchAllData());
      es.addEventListener('blocked_slots', () => fetchAllData());
      es.addEventListener('rooms', () => fetchAllData());
      es.addEventListener('screens', () => fetchAllData());
      es.addEventListener('settings', () => fetchAllData());
    } catch (err) {
      console.warn('Realtime event source init error', err);
    }

    return () => {
      if (es) es.close();
    };
  }, [fetchAllData]);

  // Day rollover at midnight Dubai time without reload (Change 1)
  React.useEffect(() => {
    const checkMidnight = () => {
      const todayDubai = formatInDubai(new Date(), 'yyyy-MM-dd');
      setScheduleDate((prev) => {
        // Automatically advance if viewing yesterday's date
        if (prev < todayDubai) {
          return todayDubai;
        }
        return prev;
      });
    };
    const interval = setInterval(checkMidnight, 30000);
    return () => clearInterval(interval);
  }, []);

  // Inactivity Auto-Lock Timer
  React.useEffect(() => {
    const timeoutMs = (settings.inactivity_lock_minutes || 15) * 60 * 1000;
    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setIsLocked(true);
      }, timeoutMs);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [settings.inactivity_lock_minutes]);

  // PIN Unlock Handler
  const handleUnlockWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setIsUnlocking(true);

    try {
      const res = await fetch('/api/auth/unlock-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsLocked(false);
        setPinInput('');
      } else {
        setPinError(data.error || 'Incorrect PIN');
      }
    } catch {
      setPinError('Connection error. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/admin/login');
    }
  };

  // Schedule Date Navigation Helpers (Change 1)
  const handlePrevDay = () => {
    const [y, m, d] = scheduleDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0));
    setScheduleDate(formatInDubai(dt, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const [y, m, d] = scheduleDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
    setScheduleDate(formatInDubai(dt, 'yyyy-MM-dd'));
  };

  const handleToday = () => {
    setScheduleDate(formatInDubai(new Date(), 'yyyy-MM-dd'));
  };

  const formattedScheduleHeading = React.useMemo(() => {
    const [y, m, d] = scheduleDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return formatInDubai(dt, 'EEE, d MMM yyyy');
  }, [scheduleDate]);

  // Strict Dubai Day Filtering for Schedule View (Change 1)
  const scheduleBookings = React.useMemo(() => {
    return bookings.filter(
      (b) => b.status === 'confirmed' && isOverlappingDubaiDay(b.start_time, b.end_time, scheduleDate)
    );
  }, [bookings, scheduleDate]);

  const scheduleBlocks = React.useMemo(() => {
    return blockedSlots.filter((block) => {
      if (block.recurring_rule === 'FRIDAY_12_14') {
        const [y, m, d] = scheduleDate.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        return formatInDubai(dt, 'EEEE') === 'Friday';
      }
      return isOverlappingDubaiDay(block.start_time, block.end_time, scheduleDate);
    });
  }, [blockedSlots, scheduleDate]);

  const nowLinePct = getDubaiNowLinePercentage(scheduleDate, settings);

  // Filtered & Paginated Bookings (Change 4)
  const filteredBookings = React.useMemo(() => {
    return bookings
      .filter((b) => bookingFilterRoom === 'ALL' || b.room_id === bookingFilterRoom)
      .filter(
        (b) =>
          b.title.toLowerCase().includes(bookingSearch.toLowerCase()) ||
          b.organizer_name.toLowerCase().includes(bookingSearch.toLowerCase()) ||
          b.organizer_email.toLowerCase().includes(bookingSearch.toLowerCase())
      );
  }, [bookings, bookingFilterRoom, bookingSearch]);

  const totalBookingPages = Math.max(1, Math.ceil(filteredBookings.length / BOOKINGS_PAGE_SIZE));
  const paginatedBookings = filteredBookings.slice(
    (bookingPage - 1) * BOOKINGS_PAGE_SIZE,
    bookingPage * BOOKINGS_PAGE_SIZE
  );

  // Paginated Blocked Slots (Change 4)
  const totalBlockPages = Math.max(1, Math.ceil(blockedSlots.length / BLOCKS_PAGE_SIZE));
  const paginatedBlocks = blockedSlots.slice(
    (blocksPage - 1) * BLOCKS_PAGE_SIZE,
    blocksPage * BLOCKS_PAGE_SIZE
  );

  // Percentage position calculator for schedule timeline blocks
  const computeSlotPercent = (startTimeIso: string, endTimeIso: string) => {
    const sDate = typeof startTimeIso === 'string' ? parseISO(startTimeIso) : startTimeIso;
    const eDate = typeof endTimeIso === 'string' ? parseISO(endTimeIso) : endTimeIso;

    const sH = parseInt(formatInDubai(sDate, 'H'), 10);
    const sM = parseInt(formatInDubai(sDate, 'm'), 10);
    const eH = parseInt(formatInDubai(eDate, 'H'), 10);
    const eM = parseInt(formatInDubai(eDate, 'm'), 10);

    const startMinutes = (sH - 8) * 60 + sM;
    const endMinutes = (eH - 8) * 60 + eM;

    const clampedStart = Math.max(0, Math.min(720, startMinutes));
    const clampedEnd = Math.max(0, Math.min(720, endMinutes));

    const topPct = (clampedStart / 720) * 100;
    const heightPct = Math.max(3.5, ((clampedEnd - clampedStart) / 720) * 100);

    return { topPct, heightPct };
  };

  // -------------------------------------------------------------------------
  // INACTIVITY PIN LOCK SCREEN
  // -------------------------------------------------------------------------
  if (isLocked) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0B1F3A]/95 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-white rounded-sm border border-corporate-hairline shadow-2xl p-6 sm:p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 text-corporate-teal mx-auto flex items-center justify-center mb-4">
            <Lock className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-black text-corporate-navy tracking-tight">Console Locked</h2>
          <p className="text-xs text-slate-500 mt-1">
            Console locked due to inactivity. Enter your quick-unlock PIN to resume.
          </p>

          <form onSubmit={handleUnlockWithPin} className="space-y-4 mt-6">
            <div>
              <input
                id="pin-unlock-input"
                type="password"
                maxLength={6}
                autoFocus
                placeholder="••••"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                className="text-center font-mono text-3xl tracking-widest h-12 w-44 mx-auto border-2 border-corporate-hairline rounded-sm focus:border-corporate-teal outline-hidden bg-slate-50"
              />
              {pinError && <p className="text-xs text-corporate-red font-semibold mt-2">{pinError}</p>}
            </div>

            <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto pt-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'Enter'].map((val, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => {
                    if (val === 'C') setPinInput('');
                    else if (val === 'Enter') handleUnlockWithPin({ preventDefault: () => {} } as any);
                    else if (pinInput.length < 6) setPinInput((p) => p + val);
                  }}
                  className="h-10 rounded-sm bg-slate-100 hover:bg-slate-200 text-corporate-charcoal font-bold text-sm transition-colors"
                >
                  {val}
                </button>
              ))}
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full bg-corporate-teal"
                disabled={isUnlocking || pinInput.length < 4}
              >
                {isUnlocking ? 'Unlocking...' : 'Unlock Console'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-slate-500">
                Full Sign Out
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // MAIN ADMIN CONSOLE APP SHELL (Change 4: 100vh, 0 scrollbars on desktop)
  // -------------------------------------------------------------------------
  return (
    <div className="h-screen max-h-screen w-screen max-w-screen overflow-hidden flex bg-[#F7F5F0] text-corporate-charcoal font-sans select-none">
      {/* FIXED SIDEBAR */}
      <aside className="w-52 shrink-0 h-full flex flex-col justify-between border-r border-white/10 bg-[#0B1F3A] text-white p-2.5 select-none overflow-hidden">
        <div>
          {/* Header */}
          <div className="px-2.5 py-3 border-b border-white/10">
            <span className="text-[10px] font-bold tracking-[0.2em] text-teal-300 uppercase block">
              Administration
            </span>
            <h1 className="text-sm font-black tracking-tight text-white mt-0.5">
              Meeting Room Booking
            </h1>
            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">192.168.50.143:3005</p>
          </div>

          {/* Nav Items (Audit Log and QR Signs removed) */}
          <nav className="p-1.5 space-y-0.5 mt-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'schedule', label: "Today's Schedule", icon: CalendarDays },
              { id: 'bookings', label: 'All Bookings', icon: CalendarCheck2 },
              { id: 'rooms', label: 'Rooms & Capacity', icon: DoorClosed },
              { id: 'blocks', label: 'Blocked Slots', icon: ShieldBan },
              { id: 'screens', label: 'Display Screens', icon: Tv },
              { id: 'settings', label: 'System Settings', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabKey)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-sm text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-corporate-teal text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-teal-300" />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3 h-3 text-teal-200" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="p-2 border-t border-white/10 space-y-1">
          <button
            onClick={() => setIsLocked(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-sm text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock Console</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-sm text-xs font-medium text-rose-300 hover:text-rose-100 hover:bg-rose-900/30 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA (Change 4: Fits 100vh exactly, no scrollbars) */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Compact Header */}
        <header className="h-11 shrink-0 bg-white border-b border-corporate-hairline px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-bold text-corporate-navy uppercase tracking-wider">
              {activeTab === 'dashboard' && 'Operations Dashboard'}
              {activeTab === 'schedule' && "Today's Schedule Comparison"}
              {activeTab === 'bookings' && 'Reservations & Management'}
              {activeTab === 'rooms' && 'Meeting Rooms Configuration'}
              {activeTab === 'blocks' && 'Blocked & Maintenance Slots'}
              {activeTab === 'screens' && 'Wall-Mounted Display Screens'}
              {activeTab === 'settings' && 'System Parameters & Security'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {notification && (
              <span className="text-[11px] bg-emerald-50 text-corporate-green px-2.5 py-0.5 rounded-xs border border-emerald-300 font-semibold animate-fade-in">
                {notification}
              </span>
            )}

            <Button variant="outline" size="sm" onClick={fetchAllData} title="Refresh data" className="h-7 text-xs px-2.5">
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>

            <Link href="/" target="_blank">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-600 px-2">
                <ExternalLink className="w-3 h-3 mr-1" />
                Public Directory
              </Button>
            </Link>
          </div>
        </header>

        {/* Content Body Container */}
        <div className="flex-1 min-h-0 p-3 overflow-hidden flex flex-col">
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="h-full flex flex-col gap-3 overflow-hidden">
              {/* Stat KPIs in 1 compact row */}
              <div className="grid grid-cols-4 gap-3 shrink-0">
                <div className="bg-white p-3 rounded-sm border border-corporate-hairline shadow-2xs">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Rooms</span>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <span className="text-xl font-black text-corporate-navy">{rooms.length}</span>
                    <span className="text-[10px] text-slate-500">{rooms.filter((r) => r.is_active).length} Active</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-sm border border-corporate-hairline shadow-2xs">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Bookings Today</span>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <span className="text-xl font-black text-corporate-navy">{stats?.bookingsToday ?? 0}</span>
                    <span className="text-[10px] text-slate-500">Confirmed</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-sm border border-corporate-hairline shadow-2xs">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Hours Booked Today</span>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <span className="text-xl font-black text-corporate-teal">{stats?.hoursBookedToday ?? 0} hrs</span>
                    <span className="text-[10px] text-slate-500">of 12h workday</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-sm border border-corporate-hairline shadow-2xs">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Facility Utilization</span>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <span className="text-xl font-black text-corporate-navy">{stats?.utilizationPercentage ?? 0}%</span>
                    <span className="text-[10px] text-corporate-teal font-semibold">Today</span>
                  </div>
                </div>
              </div>

              {/* Live Facilities Overview (5 Rooms side-by-side in 1 row) */}
              <div className="flex-1 min-h-0 flex flex-col bg-white border border-corporate-hairline rounded-sm p-3 shadow-2xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-corporate-hairline shrink-0">
                  <h3 className="text-xs font-bold text-corporate-navy uppercase tracking-wider">
                    Live Facilities Overview
                  </h3>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setShowBookOnBehalfModal(true)}
                    className="h-7 text-xs bg-corporate-teal"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Book on Behalf
                  </Button>
                </div>

                <div className="grid grid-cols-5 gap-2.5 flex-1 min-h-0 pt-2.5 items-stretch">
                  {rooms.map((room) => {
                    const roomOverview = stats?.roomsOverview?.find((o: any) => o.room.id === room.id);
                    const status = roomOverview?.status;
                    const isFree = status?.state === 'available';
                    const isOccupied = status?.state === 'occupied';

                    return (
                      <div
                        key={room.id}
                        className="bg-slate-50/70 p-3 rounded-xs border border-corporate-hairline flex flex-col justify-between overflow-hidden"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <h4 className="text-xs font-bold text-corporate-navy truncate">{room.name}</h4>
                              <p className="text-[10px] text-slate-500 truncate">{room.location}</p>
                            </div>
                            <Badge
                              variant={isFree ? 'available' : isOccupied ? 'occupied' : 'unavailable'}
                              className="text-[9px] px-1.5 py-0 shrink-0"
                            >
                              {isFree ? 'Free' : isOccupied ? 'In Use' : 'Blocked'}
                            </Badge>
                          </div>

                          <div
                            className={`p-2 rounded-xs text-[11px] mt-2 border ${
                              isFree
                                ? 'bg-emerald-50 border-emerald-200 text-corporate-green'
                                : isOccupied
                                ? 'bg-rose-50 border-rose-200 text-corporate-red'
                                : 'bg-slate-100 border-slate-200 text-slate-600'
                            }`}
                          >
                            <p className="font-semibold line-clamp-2">{status?.bannerText || 'Checking status...'}</p>
                            {status?.nextMeetingSummary && (
                              <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                                {status.nextMeetingSummary}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                          <span>Cap: {room.capacity}</span>
                          <Link
                            href={`/room/${room.id}`}
                            target="_blank"
                            className="text-corporate-teal font-semibold hover:underline flex items-center gap-0.5"
                          >
                            Open <ArrowRight className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TODAY'S SCHEDULE (Multi-room Timeline, Scales to height, zero scrollbar) */}
          {activeTab === 'schedule' && (
            <div className="h-full flex flex-col gap-2 overflow-hidden">
              {/* Date Navigation & Controls Bar (Change 1) */}
              <div className="h-9 shrink-0 bg-white px-3 rounded-sm border border-corporate-hairline flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-xs border border-corporate-hairline overflow-hidden bg-slate-50">
                    <button
                      onClick={handlePrevDay}
                      className="h-6 px-2 hover:bg-slate-200 text-xs font-bold text-corporate-charcoal"
                      title="Previous Day"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleToday}
                      className="h-6 px-2.5 hover:bg-slate-200 text-xs font-semibold border-x border-corporate-hairline text-corporate-navy"
                    >
                      Today
                    </button>
                    <button
                      onClick={handleNextDay}
                      className="h-6 px-2 hover:bg-slate-200 text-xs font-bold text-corporate-charcoal"
                      title="Next Day"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => e.target.value && setScheduleDate(e.target.value)}
                    className="h-6 px-2 text-xs border border-corporate-hairline rounded-xs bg-white text-corporate-charcoal"
                  />

                  <h3 className="text-xs font-black text-corporate-navy ml-1">{formattedScheduleHeading}</h3>
                </div>

                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-xs bg-emerald-500" /> Free
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-xs bg-corporate-red" /> Occupied
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-xs bg-slate-400" /> Blocked
                  </span>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setShowBookOnBehalfModal(true)}
                    className="h-6 text-xs bg-corporate-navy ml-2 px-2"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Book
                  </Button>
                </div>
              </div>

              {/* Scaled Multi-Room Timeline (Fits 08:00 - 20:00 on screen without scrolling) */}
              <div className="flex-1 min-h-0 bg-white border border-corporate-hairline rounded-sm flex flex-col overflow-hidden shadow-2xs">
                {/* Room Headers Row */}
                <div className="h-7 shrink-0 grid grid-cols-[48px_repeat(5,1fr)] bg-corporate-navy text-white text-center border-b border-corporate-navy items-center text-xs font-bold">
                  <div className="text-[10px] text-teal-300 font-mono">GST</div>
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      className="truncate px-1 border-l border-white/10 flex items-center justify-center gap-1"
                    >
                      <span className="truncate">{room.name}</span>
                      <span className="text-[10px] text-teal-300 font-normal">({room.capacity})</span>
                    </div>
                  ))}
                </div>

                {/* Timeline Grid: 12 Hours (08:00 to 20:00) */}
                <div className="flex-1 min-h-0 relative grid grid-cols-[48px_repeat(5,1fr)]">
                  {/* Left Time Axis */}
                  <div className="h-full flex flex-col justify-between border-r border-corporate-hairline text-[9px] text-slate-400 font-mono select-none text-center bg-slate-50/70">
                    {HOURS_LIST.map((h) => (
                      <div key={h} className="flex-1 flex items-start justify-center border-b border-dashed border-slate-200 last:border-b-0">
                        <span>{String(h).padStart(2, '0')}:00</span>
                      </div>
                    ))}
                  </div>

                  {/* 5 Room Columns */}
                  {rooms.map((room) => {
                    const roomBookings = scheduleBookings.filter((b) => b.room_id === room.id);
                    const roomBlocks = scheduleBlocks.filter(
                      (b) => b.room_id === null || b.room_id === room.id
                    );

                    return (
                      <div
                        key={room.id}
                        className="h-full relative border-r border-corporate-hairline last:border-r-0 overflow-hidden"
                      >
                        {/* Background Hour Lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                          {HOURS_LIST.map((h) => (
                            <div key={h} className="flex-1 border-b border-slate-100 last:border-b-0" />
                          ))}
                        </div>

                        {/* Confirmed Bookings for selected day */}
                        {roomBookings.map((b) => {
                          const { topPct, heightPct } = computeSlotPercent(b.start_time, b.end_time);
                          return (
                            <div
                              key={b.id}
                              style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                              className="absolute left-1 right-1 rounded-xs bg-rose-100/90 border border-rose-300 text-corporate-charcoal p-1 overflow-hidden shadow-2xs z-10 flex flex-col justify-center cursor-pointer hover:border-corporate-red"
                              title={`${b.title} (${formatInDubai(b.start_time, 'HH:mm')} – ${formatInDubai(
                                b.end_time,
                                'HH:mm'
                              )}) by ${b.organizer_name}`}
                              onClick={() => {
                                setEditingBooking(b);
                                setShowEditBookingModal(true);
                              }}
                            >
                              <div className="text-[9px] font-mono font-bold text-corporate-red truncate leading-tight">
                                {formatInDubai(b.start_time, 'HH:mm')} – {formatInDubai(b.end_time, 'HH:mm')}
                              </div>
                              <div className="text-[10px] font-bold text-corporate-navy truncate leading-tight">
                                {b.title}
                              </div>
                              <div className="text-[9px] text-slate-500 truncate leading-tight">
                                {b.organizer_name}
                              </div>
                            </div>
                          );
                        })}

                        {/* Blocked Slots for selected day */}
                        {roomBlocks.map((block) => {
                          const { topPct, heightPct } = computeSlotPercent(block.start_time, block.end_time);
                          return (
                            <div
                              key={block.id}
                              style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                              className="absolute left-1 right-1 rounded-xs bg-slate-200/90 border border-slate-300 text-slate-700 p-1 overflow-hidden shadow-2xs z-10 flex flex-col justify-center"
                              title={`Unavailable: ${block.title}`}
                            >
                              <div className="text-[9px] font-mono font-bold text-slate-600 truncate">
                                Unavailable
                              </div>
                              <div className="text-[10px] font-semibold text-slate-800 truncate">
                                {block.title}
                              </div>
                            </div>
                          );
                        })}

                        {/* Live Now Line */}
                        {nowLinePct !== null && (
                          <div
                            style={{ top: `${nowLinePct}%` }}
                            className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
                          >
                            <span className="absolute -top-1 -left-0.5 w-2 h-2 rounded-full bg-red-500" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ALL BOOKINGS (Paginated, zero scrollbar) */}
          {activeTab === 'bookings' && (
            <div className="h-full flex flex-col gap-2.5 overflow-hidden">
              {/* Filter Bar */}
              <div className="bg-white p-2.5 rounded-sm border border-corporate-hairline flex items-center justify-between shrink-0 shadow-2xs">
                <div className="flex items-center gap-2">
                  <select
                    value={bookingFilterRoom}
                    onChange={(e) => {
                      setBookingFilterRoom(e.target.value);
                      setBookingPage(1);
                    }}
                    className="h-7 px-2.5 text-xs border border-corporate-hairline rounded-sm bg-white text-corporate-charcoal"
                  >
                    <option value="ALL">All Meeting Rooms</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  <div className="relative w-56">
                    <Search className="w-3 h-3 absolute left-2.5 top-2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search title, organizer..."
                      value={bookingSearch}
                      onChange={(e) => {
                        setBookingSearch(e.target.value);
                        setBookingPage(1);
                      }}
                      className="h-7 w-full pl-7 pr-2.5 text-xs border border-corporate-hairline rounded-sm"
                    />
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setShowBookOnBehalfModal(true)}
                  className="h-7 text-xs bg-corporate-navy"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  + Book on Behalf
                </Button>
              </div>

              {/* Bookings Table */}
              <div className="flex-1 min-h-0 bg-white border border-corporate-hairline rounded-sm shadow-2xs flex flex-col justify-between overflow-hidden">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-corporate-offwhite border-b border-corporate-hairline text-corporate-charcoal font-semibold uppercase tracking-wider text-[10px]">
                        <th className="p-2.5">Room</th>
                        <th className="p-2.5">Date & Time (Dubai)</th>
                        <th className="p-2.5">Meeting Title</th>
                        <th className="p-2.5">Organizer</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-corporate-hairline">
                      {paginatedBookings.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            No reservations found matching the filters.
                          </td>
                        </tr>
                      ) : (
                        paginatedBookings.map((b) => {
                          const roomObj = rooms.find((r) => r.id === b.room_id);
                          return (
                            <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 font-semibold text-corporate-navy">
                                {roomObj?.name || 'Unknown Room'}
                              </td>
                              <td className="p-2.5 font-mono text-corporate-charcoal">
                                <div>{formatInDubai(b.start_time, 'EEE, d MMM yyyy')}</div>
                                <div className="text-slate-500 text-[10px]">
                                  {formatInDubai(b.start_time, 'HH:mm')} – {formatInDubai(b.end_time, 'HH:mm')}
                                </div>
                              </td>
                              <td className="p-2.5 font-medium text-corporate-charcoal truncate max-w-xs">{b.title}</td>
                              <td className="p-2.5">
                                <div className="font-semibold truncate max-w-[150px]">{b.organizer_name}</div>
                                <div className="text-slate-400 text-[10px] truncate max-w-[150px]">{b.organizer_email}</div>
                              </td>
                              <td className="p-2.5">
                                <Badge variant={b.status === 'confirmed' ? 'available' : 'unavailable'} className="text-[10px]">
                                  {b.status}
                                </Badge>
                              </td>
                              <td className="p-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {b.status === 'confirmed' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[10px] px-2"
                                        onClick={() => {
                                          setEditingBooking(b);
                                          setShowEditBookingModal(true);
                                        }}
                                      >
                                        Edit
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="danger"
                                        className="h-6 text-[10px] px-2"
                                        onClick={async () => {
                                          if (confirm(`Cancel reservation "${b.title}"?`)) {
                                            const res = await fetch(`/api/bookings/${b.id}`, { method: 'DELETE' });
                                            if (res.ok) {
                                              showNotify('Booking cancelled successfully');
                                              fetchAllData();
                                            }
                                          }
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="h-9 shrink-0 px-3 border-t border-corporate-hairline bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Showing {filteredBookings.length > 0 ? (bookingPage - 1) * BOOKINGS_PAGE_SIZE + 1 : 0} to{' '}
                    {Math.min(bookingPage * BOOKINGS_PAGE_SIZE, filteredBookings.length)} of {filteredBookings.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2"
                      disabled={bookingPage <= 1}
                      onClick={() => setBookingPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-xs font-semibold px-1">
                      {bookingPage} / {totalBookingPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2"
                      disabled={bookingPage >= totalBookingPages}
                      onClick={() => setBookingPage((p) => Math.min(totalBookingPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ROOMS & CAPACITY */}
          {activeTab === 'rooms' && (
            <div className="h-full flex flex-col gap-2.5 overflow-hidden">
              <div className="bg-white p-2.5 rounded-sm border border-corporate-hairline flex items-center justify-between shrink-0 shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-corporate-navy uppercase tracking-wider">
                    Meeting Rooms Directory ({rooms.length} Total)
                  </h3>
                  <p className="text-[11px] text-slate-500">Each room has its unique QR and permanent booking URL.</p>
                </div>
                <Button size="sm" variant="primary" onClick={() => setShowAddRoomModal(true)} className="h-7 text-xs bg-corporate-navy">
                  <Plus className="w-3 h-3 mr-1" /> Add Room
                </Button>
              </div>

              <div className="flex-1 min-h-0 bg-white border border-corporate-hairline rounded-sm shadow-2xs overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-corporate-offwhite border-b border-corporate-hairline text-corporate-charcoal font-semibold uppercase tracking-wider text-[10px]">
                      <th className="p-2.5">Room</th>
                      <th className="p-2.5">Location</th>
                      <th className="p-2.5">Capacity</th>
                      <th className="p-2.5">Amenities</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-corporate-hairline">
                    {rooms.map((room) => (
                      <tr key={room.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 font-bold text-corporate-navy">{room.name}</td>
                        <td className="p-2.5 text-slate-600">{room.location}</td>
                        <td className="p-2.5 font-semibold">{room.capacity} Persons</td>
                        <td className="p-2.5 text-slate-500 truncate max-w-xs">{room.amenities?.join(', ') || 'Standard setup'}</td>
                        <td className="p-2.5">
                          <Badge variant={room.is_active ? 'available' : 'unavailable'} className="text-[10px]">
                            {room.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] px-2"
                              onClick={() => {
                                setEditingRoom(room);
                                setShowEditRoomModal(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Link href={`/room/${room.id}`} target="_blank">
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-corporate-teal">
                                Open
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: BLOCKED SLOTS (Paginated, zero scrollbar) */}
          {activeTab === 'blocks' && (
            <div className="h-full flex flex-col gap-2.5 overflow-hidden">
              <div className="bg-white p-2.5 rounded-sm border border-corporate-hairline flex items-center justify-between shrink-0 shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-corporate-navy uppercase tracking-wider">
                    Maintenance & Reserved Blocks
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Blocks prevent employees from booking rooms during prayer breaks or events.
                  </p>
                </div>
                <Button size="sm" variant="primary" onClick={() => setShowAddBlockModal(true)} className="h-7 text-xs bg-corporate-red">
                  <ShieldBan className="w-3 h-3 mr-1" /> + Block Time Slot
                </Button>
              </div>

              <div className="flex-1 min-h-0 bg-white border border-corporate-hairline rounded-sm shadow-2xs flex flex-col justify-between overflow-hidden">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-corporate-offwhite border-b border-corporate-hairline text-corporate-charcoal font-semibold uppercase tracking-wider text-[10px]">
                        <th className="p-2.5">Scope</th>
                        <th className="p-2.5">Block Title / Reason</th>
                        <th className="p-2.5">Start Time (Dubai)</th>
                        <th className="p-2.5">End Time (Dubai)</th>
                        <th className="p-2.5">Recurrence</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-corporate-hairline">
                      {paginatedBlocks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            No blocked time slots found.
                          </td>
                        </tr>
                      ) : (
                        paginatedBlocks.map((block) => {
                          const roomObj = rooms.find((r) => r.id === block.room_id);
                          return (
                            <tr key={block.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 font-bold text-corporate-navy">
                                {block.room_id ? roomObj?.name || 'Specific Room' : 'ALL ROOMS'}
                              </td>
                              <td className="p-2.5">
                                <div className="font-semibold text-corporate-charcoal">{block.title}</div>
                                {block.reason && <div className="text-[10px] text-slate-400 truncate max-w-xs">{block.reason}</div>}
                              </td>
                              <td className="p-2.5 font-mono text-slate-600">
                                {formatInDubai(block.start_time, 'd MMM yyyy, HH:mm')}
                              </td>
                              <td className="p-2.5 font-mono text-slate-600">
                                {formatInDubai(block.end_time, 'd MMM yyyy, HH:mm')}
                              </td>
                              <td className="p-2.5">
                                {block.recurring_rule ? (
                                  <Badge variant="unavailable" className="text-[10px]">
                                    Weekly Friday
                                  </Badge>
                                ) : (
                                  <span className="text-slate-400">One-time</span>
                                )}
                              </td>
                              <td className="p-2.5 text-right">
                                <Button
                                  size="sm"
                                  variant="danger"
                                  className="h-6 text-[10px] px-2"
                                  onClick={async () => {
                                    if (confirm(`Remove block "${block.title}"?`)) {
                                      const res = await fetch(`/api/blocks/${block.id}`, { method: 'DELETE' });
                                      if (res.ok) {
                                        showNotify('Block deleted');
                                        fetchAllData();
                                      }
                                    }
                                  }}
                                >
                                  Delete
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="h-9 shrink-0 px-3 border-t border-corporate-hairline bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Showing {blockedSlots.length > 0 ? (blocksPage - 1) * BLOCKS_PAGE_SIZE + 1 : 0} to{' '}
                    {Math.min(blocksPage * BLOCKS_PAGE_SIZE, blockedSlots.length)} of {blockedSlots.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2"
                      disabled={blocksPage <= 1}
                      onClick={() => setBlocksPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-xs font-semibold px-1">
                      {blocksPage} / {totalBlockPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2"
                      disabled={blocksPage >= totalBlockPages}
                      onClick={() => setBlocksPage((p) => Math.min(totalBlockPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: DISPLAY SCREENS */}
          {activeTab === 'screens' && (
            <div className="h-full flex flex-col gap-2.5 overflow-hidden">
              <div className="bg-white p-2.5 rounded-sm border border-corporate-hairline flex items-center justify-between shrink-0 shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-corporate-navy uppercase tracking-wider">
                    Wall-Mounted Display Screens
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Dedicated tablet screens mounted outside each room running silent background heartbeats.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/display/lobby" target="_blank">
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      Open Lobby Board
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setShowRegisterScreenModal(true)}
                    className="h-7 text-xs bg-corporate-navy"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Display
                  </Button>
                </div>
              </div>

              <div className="flex-1 min-h-0 bg-white border border-corporate-hairline rounded-sm shadow-2xs overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-corporate-offwhite border-b border-corporate-hairline text-corporate-charcoal font-semibold uppercase tracking-wider text-[10px]">
                      <th className="p-2.5">Screen Name</th>
                      <th className="p-2.5">Room</th>
                      <th className="p-2.5">Orientation</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Last Seen</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-corporate-hairline">
                    {screens.map((screen) => {
                      const roomObj = rooms.find((r) => r.id === screen.room_id);
                      return (
                        <tr key={screen.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 font-bold text-corporate-navy">{screen.name}</td>
                          <td className="p-2.5 text-slate-700">{roomObj?.name || 'Lobby'}</td>
                          <td className="p-2.5 capitalize">{screen.orientation}</td>
                          <td className="p-2.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                screen.is_online
                                  ? 'bg-emerald-100 text-corporate-green border border-emerald-300'
                                  : 'bg-slate-200 text-slate-600 border border-slate-300'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  screen.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                }`}
                              />
                              {screen.is_online ? 'Online' : 'Offline'}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-slate-500 text-[11px]">
                            {screen.last_heartbeat_at
                              ? formatInDubai(screen.last_heartbeat_at, 'HH:mm:ss')
                              : 'Never'}
                          </td>
                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2"
                                onClick={async () => {
                                  const res = await fetch(`/api/screens/${screen.id}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'RELOAD' }),
                                  });
                                  if (res.ok) showNotify('Reload signal dispatched');
                                }}
                              >
                                Reload
                              </Button>
                              <Link href={`/display/${screen.room_id}`} target="_blank">
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-corporate-teal">
                                  View
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: SETTINGS (Two-column layout, fits 100vh without scrollbar) */}
          {activeTab === 'settings' && (
            <div className="h-full flex flex-col gap-2.5 overflow-hidden">
              <div className="bg-white p-2.5 rounded-sm border border-corporate-hairline shrink-0 shadow-2xs">
                <h3 className="text-xs font-bold text-corporate-navy uppercase tracking-wider">
                  System Parameters & Security
                </h3>
                <p className="text-[11px] text-slate-500">
                  Global booking rules, working hours, auto-lock timeout, and administrative credentials.
                </p>
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-2 gap-3 overflow-hidden">
                {/* Column 1: Booking Rules */}
                <form
                  id="settings-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const work_start_hour = parseInt((form.elements.namedItem('work_start') as HTMLInputElement).value, 10);
                    const work_end_hour = parseInt((form.elements.namedItem('work_end') as HTMLInputElement).value, 10);
                    const slot_duration_minutes = parseInt((form.elements.namedItem('slot_duration') as HTMLInputElement).value, 10);
                    const max_booking_duration_hours = parseInt((form.elements.namedItem('max_duration') as HTMLInputElement).value, 10);
                    const max_advance_booking_days = parseInt((form.elements.namedItem('max_advance') as HTMLInputElement).value, 10);
                    const inactivity_lock_minutes = parseInt((form.elements.namedItem('inactivity_lock') as HTMLInputElement).value, 10);
                    const privacy_mode = (form.elements.namedItem('privacy_mode') as HTMLInputElement).checked;

                    const res = await fetch('/api/settings', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        work_start_hour,
                        work_end_hour,
                        slot_duration_minutes,
                        max_booking_duration_hours,
                        max_advance_booking_days,
                        inactivity_lock_minutes,
                        privacy_mode,
                      }),
                    });

                    if (res.ok) {
                      showNotify('Settings updated successfully');
                      fetchAllData();
                    }
                  }}
                  className="bg-white p-4 rounded-sm border border-corporate-hairline shadow-2xs flex flex-col justify-between overflow-hidden"
                >
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-corporate-navy uppercase tracking-wider border-b pb-1.5">
                      Working Hours & Policy
                    </h4>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Input
                        id="set-work-start"
                        name="work_start"
                        label="Work Start (Hour)"
                        type="number"
                        min={0}
                        max={23}
                        defaultValue={settings.work_start_hour}
                        required
                        className="h-8 text-xs"
                      />
                      <Input
                        id="set-work-end"
                        name="work_end"
                        label="Work End (Hour)"
                        type="number"
                        min={1}
                        max={24}
                        defaultValue={settings.work_end_hour}
                        required
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <Input
                        id="set-slot-duration"
                        name="slot_duration"
                        label="Slot Duration (Minutes)"
                        type="number"
                        step={15}
                        min={15}
                        max={120}
                        defaultValue={settings.slot_duration_minutes}
                        required
                        className="h-8 text-xs"
                      />
                      <Input
                        id="set-max-duration"
                        name="max_duration"
                        label="Max Duration (Hours)"
                        type="number"
                        min={1}
                        max={12}
                        defaultValue={settings.max_booking_duration_hours}
                        required
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <Input
                        id="set-max-advance"
                        name="max_advance"
                        label="Max Advance (Days)"
                        type="number"
                        min={1}
                        max={180}
                        defaultValue={settings.max_advance_booking_days}
                        required
                        className="h-8 text-xs"
                      />
                      <Input
                        id="set-inactivity-lock"
                        name="inactivity_lock"
                        label="Inactivity Timeout (Mins)"
                        type="number"
                        min={1}
                        max={120}
                        defaultValue={settings.inactivity_lock_minutes}
                        required
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-corporate-hairline flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="privacy_mode"
                        defaultChecked={settings.privacy_mode}
                        className="w-4 h-4 rounded text-corporate-teal"
                      />
                      <span className="text-xs font-semibold text-corporate-charcoal">Privacy Mode</span>
                    </label>
                    <Button type="submit" variant="primary" size="sm" className="h-7 text-xs bg-corporate-navy">
                      Save Parameters
                    </Button>
                  </div>
                </form>

                {/* Column 2: Credentials & Admin Security */}
                <div className="bg-white p-4 rounded-sm border border-corporate-hairline shadow-2xs flex flex-col justify-between overflow-hidden">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-corporate-navy uppercase tracking-wider border-b pb-1.5">
                      Receptionist & Admin Authentication
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      This application enforces single-admin access. Passwords are protected against brute force with a
                      5-failed-attempts lockout (15-minute freeze).
                    </p>

                    <div className="p-3 bg-slate-50 rounded-xs border border-corporate-hairline space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-corporate-navy">Admin Password</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setShowChangePasswordModal(true)}
                        >
                          Change Password
                        </Button>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <span className="text-xs font-bold text-corporate-navy">Quick-Unlock PIN</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setShowChangePinModal(true)}
                        >
                          Change PIN
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-teal-50/60 rounded-xs border border-teal-200 text-xs text-corporate-navy font-mono">
                    Fixed Internal IP: 192.168.50.143:3005 • Asia/Dubai (UTC+4)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: ADD ROOM */}
      <Modal
        isOpen={showAddRoomModal}
        onClose={() => setShowAddRoomModal(false)}
        title="Add Meeting Room"
        description="Creates a new facility and permanent booking URL."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const name = (form.elements.namedItem('room_name') as HTMLInputElement).value;
            const location = (form.elements.namedItem('room_location') as HTMLInputElement).value;
            const capacity = parseInt((form.elements.namedItem('room_capacity') as HTMLInputElement).value, 10);
            const amenitiesStr = (form.elements.namedItem('room_amenities') as HTMLInputElement).value;
            const amenities = amenitiesStr.split(',').map((s) => s.trim()).filter(Boolean);

            const res = await fetch('/api/rooms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, location, capacity, amenities, is_active: true }),
            });

            if (res.ok) {
              showNotify('Meeting room created successfully');
              setShowAddRoomModal(false);
              fetchAllData();
            }
          }}
          className="space-y-4"
        >
          <Input id="add-room-name" name="room_name" label="Room Name" defaultValue={`Meeting Room ${rooms.length + 1}`} required />
          <Input id="add-room-location" name="room_location" label="Location / Floor" placeholder="e.g. Floor 2, East Wing" required />
          <Input id="add-room-capacity" name="room_capacity" label="Capacity" type="number" min={1} defaultValue={8} required />
          <Input id="add-room-amenities" name="room_amenities" label="Amenities" placeholder="4K Screen, Video Bar" />
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddRoomModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="bg-corporate-navy">
              Create Room
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: EDIT ROOM */}
      <Modal
        isOpen={showEditRoomModal}
        onClose={() => {
          setShowEditRoomModal(false);
          setEditingRoom(null);
        }}
        title={`Edit ${editingRoom?.name || 'Room'}`}
      >
        {editingRoom && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const name = (form.elements.namedItem('edit_name') as HTMLInputElement).value;
              const location = (form.elements.namedItem('edit_location') as HTMLInputElement).value;
              const capacity = parseInt((form.elements.namedItem('edit_capacity') as HTMLInputElement).value, 10);
              const amenitiesStr = (form.elements.namedItem('edit_amenities') as HTMLInputElement).value;
              const amenities = amenitiesStr.split(',').map((s) => s.trim()).filter(Boolean);

              const res = await fetch(`/api/rooms/${editingRoom.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, location, capacity, amenities }),
              });

              if (res.ok) {
                showNotify('Room details updated');
                setShowEditRoomModal(false);
                setEditingRoom(null);
                fetchAllData();
              }
            }}
            className="space-y-4"
          >
            <Input id="edit-room-name" name="edit_name" label="Room Name" defaultValue={editingRoom.name} required />
            <Input id="edit-room-location" name="edit_location" label="Location" defaultValue={editingRoom.location} required />
            <Input id="edit-room-capacity" name="edit_capacity" label="Capacity" type="number" defaultValue={editingRoom.capacity} required />
            <Input id="edit-room-amenities" name="edit_amenities" label="Amenities" defaultValue={editingRoom.amenities?.join(', ')} />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowEditRoomModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="bg-corporate-navy">
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: BOOK ON BEHALF */}
      <Modal
        isOpen={showBookOnBehalfModal}
        onClose={() => setShowBookOnBehalfModal(false)}
        title="Admin: Book on Behalf"
        description="Schedule a meeting for an executive or department."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const room_id = (form.elements.namedItem('bob_room') as HTMLSelectElement).value;
            const title = (form.elements.namedItem('bob_title') as HTMLInputElement).value;
            const organizer_name = (form.elements.namedItem('bob_name') as HTMLInputElement).value;
            const organizer_email = (form.elements.namedItem('bob_email') as HTMLInputElement).value;
            const date = (form.elements.namedItem('bob_date') as HTMLInputElement).value;
            const startTimeStr = (form.elements.namedItem('bob_start') as HTMLInputElement).value;
            const endTimeStr = (form.elements.namedItem('bob_end') as HTMLInputElement).value;

            const [sH, sM] = startTimeStr.split(':').map(Number);
            const [eH, eM] = endTimeStr.split(':').map(Number);
            const [y, m, d] = date.split('-').map(Number);

            // Convert Dubai inputs to UTC
            const start_time = new Date(Date.UTC(y, m - 1, d, sH - 4, sM)).toISOString();
            const end_time = new Date(Date.UTC(y, m - 1, d, eH - 4, eM)).toISOString();

            const res = await fetch('/api/bookings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                room_id,
                title,
                organizer_name,
                organizer_email,
                start_time,
                end_time,
              }),
            });

            const data = await res.json();
            if (res.ok) {
              showNotify('Reservation confirmed successfully');
              setShowBookOnBehalfModal(false);
              fetchAllData();
            } else {
              alert(data.error || 'Failed to create booking');
            }
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-xs font-semibold text-corporate-charcoal mb-1 block">Meeting Room</label>
            <select
              name="bob_room"
              required
              className="w-full h-9 px-3 text-xs border border-corporate-hairline rounded-sm bg-white"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (Cap: {r.capacity})
                </option>
              ))}
            </select>
          </div>
          <Input id="bob-title" name="bob_title" label="Meeting Title" placeholder="e.g. Quarterly Executive Review" required />
          <div className="grid grid-cols-2 gap-2">
            <Input id="bob-name" name="bob_name" label="Organizer Name" placeholder="e.g. Director Sarah" required />
            <Input id="bob-email" name="bob_email" label="Organizer Email" type="email" placeholder="sarah@internal.net" required />
          </div>
          <Input id="bob-date" name="bob_date" label="Date" type="date" defaultValue={scheduleDate} required />
          <div className="grid grid-cols-2 gap-2">
            <Input id="bob-start" name="bob_start" label="Start Time (Dubai)" type="time" defaultValue="09:00" required />
            <Input id="bob-end" name="bob_end" label="End Time (Dubai)" type="time" defaultValue="10:00" required />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowBookOnBehalfModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="bg-corporate-navy">
              Confirm Reservation
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: EDIT / MOVE BOOKING */}
      <Modal
        isOpen={showEditBookingModal}
        onClose={() => {
          setShowEditBookingModal(false);
          setEditingBooking(null);
        }}
        title={`Edit Booking: ${editingBooking?.title || ''}`}
      >
        {editingBooking && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const room_id = (form.elements.namedItem('edit_b_room') as HTMLSelectElement).value;
              const title = (form.elements.namedItem('edit_b_title') as HTMLInputElement).value;
              const organizer_name = (form.elements.namedItem('edit_b_name') as HTMLInputElement).value;
              const date = (form.elements.namedItem('edit_b_date') as HTMLInputElement).value;
              const startStr = (form.elements.namedItem('edit_b_start') as HTMLInputElement).value;
              const endStr = (form.elements.namedItem('edit_b_end') as HTMLInputElement).value;

              const [sH, sM] = startStr.split(':').map(Number);
              const [eH, eM] = endStr.split(':').map(Number);
              const [y, m, d] = date.split('-').map(Number);

              const start_time = new Date(Date.UTC(y, m - 1, d, sH - 4, sM)).toISOString();
              const end_time = new Date(Date.UTC(y, m - 1, d, eH - 4, eM)).toISOString();

              const res = await fetch(`/api/bookings/${editingBooking.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room_id, title, organizer_name, start_time, end_time }),
              });

              const data = await res.json();
              if (res.ok) {
                showNotify('Booking updated successfully');
                setShowEditBookingModal(false);
                setEditingBooking(null);
                fetchAllData();
              } else {
                alert(data.error || 'Failed to update booking');
              }
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs font-semibold text-corporate-charcoal mb-1 block">Room</label>
              <select
                name="edit_b_room"
                defaultValue={editingBooking.room_id}
                className="w-full h-9 px-3 text-xs border border-corporate-hairline rounded-sm bg-white"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <Input id="edit-b-title" name="edit_b_title" label="Title" defaultValue={editingBooking.title} required />
            <Input id="edit-b-name" name="edit_b_name" label="Organizer" defaultValue={editingBooking.organizer_name} required />
            <Input
              id="edit-b-date"
              name="edit_b_date"
              label="Date"
              type="date"
              defaultValue={formatInDubai(editingBooking.start_time, 'yyyy-MM-dd')}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                id="edit-b-start"
                name="edit_b_start"
                label="Start Time"
                type="time"
                defaultValue={formatInDubai(editingBooking.start_time, 'HH:mm')}
                required
              />
              <Input
                id="edit-b-end"
                name="edit_b_end"
                label="End Time"
                type="time"
                defaultValue={formatInDubai(editingBooking.end_time, 'HH:mm')}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowEditBookingModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="bg-corporate-navy">
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: ADD BLOCKED SLOT */}
      <Modal
        isOpen={showAddBlockModal}
        onClose={() => setShowAddBlockModal(false)}
        title="Block Time Slot"
        description="Prevent employee bookings during maintenance or executive holds."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const roomVal = (form.elements.namedItem('block_room') as HTMLSelectElement).value;
            const room_id = roomVal === 'ALL' ? null : roomVal;
            const title = (form.elements.namedItem('block_title') as HTMLInputElement).value;
            const reason = (form.elements.namedItem('block_reason') as HTMLInputElement).value;
            const date = (form.elements.namedItem('block_date') as HTMLInputElement).value;
            const startStr = (form.elements.namedItem('block_start') as HTMLInputElement).value;
            const endStr = (form.elements.namedItem('block_end') as HTMLInputElement).value;

            const [sH, sM] = startStr.split(':').map(Number);
            const [eH, eM] = endStr.split(':').map(Number);
            const [y, m, d] = date.split('-').map(Number);

            const start_time = new Date(Date.UTC(y, m - 1, d, sH - 4, sM)).toISOString();
            const end_time = new Date(Date.UTC(y, m - 1, d, eH - 4, eM)).toISOString();

            const res = await fetch('/api/blocks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ room_id, title, reason, start_time, end_time }),
            });

            if (res.ok) {
              showNotify('Time slot blocked successfully');
              setShowAddBlockModal(false);
              fetchAllData();
            } else {
              const err = await res.json();
              alert(err.error || 'Failed to create block');
            }
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-xs font-semibold text-corporate-charcoal mb-1 block">Scope</label>
            <select name="block_room" className="w-full h-9 px-3 text-xs border border-corporate-hairline rounded-sm bg-white">
              <option value="ALL">ALL MEETING ROOMS (Global Block)</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} only
                </option>
              ))}
            </select>
          </div>
          <Input id="block-title" name="block_title" label="Block Title" placeholder="e.g. Deep Cleaning / Audio Calibration" required />
          <Input id="block-reason" name="block_reason" label="Reason (Optional)" placeholder="e.g. Facilities maintenance team" />
          <Input id="block-date" name="block_date" label="Date" type="date" defaultValue={scheduleDate} required />
          <div className="grid grid-cols-2 gap-2">
            <Input id="block-start" name="block_start" label="Start Time (Dubai)" type="time" defaultValue="12:00" required />
            <Input id="block-end" name="block_end" label="End Time (Dubai)" type="time" defaultValue="14:00" required />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddBlockModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="bg-corporate-red">
              Apply Block
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: REGISTER DISPLAY SCREEN */}
      <Modal
        isOpen={showRegisterScreenModal}
        onClose={() => setShowRegisterScreenModal(false)}
        title="Register Wall Display Screen"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const name = (form.elements.namedItem('screen_name') as HTMLInputElement).value;
            const room_id = (form.elements.namedItem('screen_room') as HTMLSelectElement).value;
            const orientation = (form.elements.namedItem('screen_orientation') as HTMLSelectElement).value as any;

            const res = await fetch('/api/screens', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, room_id, orientation }),
            });

            if (res.ok) {
              showNotify('Display registered');
              setShowRegisterScreenModal(false);
              fetchAllData();
            }
          }}
          className="space-y-3"
        >
          <Input id="screen-name" name="screen_name" label="Display Screen Name" placeholder="e.g. Meeting Room 1 Tablet" required />
          <div>
            <label className="text-xs font-semibold text-corporate-charcoal mb-1 block">Associated Room</label>
            <select name="screen_room" className="w-full h-9 px-3 text-xs border border-corporate-hairline rounded-sm bg-white" required>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-corporate-charcoal mb-1 block">Orientation</label>
            <select name="screen_orientation" className="w-full h-9 px-3 text-xs border border-corporate-hairline rounded-sm bg-white">
              <option value="landscape">Landscape (Horizontal)</option>
              <option value="portrait">Portrait (Vertical)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowRegisterScreenModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="bg-corporate-navy">
              Register Screen
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CHANGE ADMIN PASSWORD */}
      <Modal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        title="Change Admin Password"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const currentPassword = (form.elements.namedItem('current_pass') as HTMLInputElement).value;
            const newPassword = (form.elements.namedItem('new_pass') as HTMLInputElement).value;
            const confirmPassword = (form.elements.namedItem('confirm_pass') as HTMLInputElement).value;

            if (newPassword !== confirmPassword) {
              alert('New passwords do not match');
              return;
            }

            const res = await fetch('/api/auth/change-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await res.json();
            if (res.ok) {
              showNotify('Password updated successfully');
              setShowChangePasswordModal(false);
            } else {
              alert(data.error || 'Failed to update password');
            }
          }}
          className="space-y-3"
        >
          <Input id="current-pass" name="current_pass" label="Current Password" type="password" required />
          <Input id="new-pass" name="new_pass" label="New Password (min 8 chars)" type="password" minLength={8} required />
          <Input id="confirm-pass" name="confirm_pass" label="Confirm New Password" type="password" minLength={8} required />
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowChangePasswordModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="bg-corporate-navy">
              Update Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CHANGE PIN */}
      <Modal
        isOpen={showChangePinModal}
        onClose={() => setShowChangePinModal(false)}
        title="Change Quick-Unlock PIN"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const currentPassword = (form.elements.namedItem('pin_auth_pass') as HTMLInputElement).value;
            const newPin = (form.elements.namedItem('new_pin') as HTMLInputElement).value;

            if (!/^\d{4,6}$/.test(newPin)) {
              alert('PIN must be 4 to 6 numeric digits');
              return;
            }

            const res = await fetch('/api/auth/change-pin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ currentPassword, newPin }),
            });

            const data = await res.json();
            if (res.ok) {
              showNotify('Quick-unlock PIN updated successfully');
              setShowChangePinModal(false);
            } else {
              alert(data.error || 'Failed to update PIN');
            }
          }}
          className="space-y-3"
        >
          <Input id="pin-auth-pass" name="pin_auth_pass" label="Current Admin Password" type="password" required />
          <Input id="new-pin" name="new_pin" label="New PIN (4-6 digits)" type="password" maxLength={6} required />
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowChangePinModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="bg-corporate-teal">
              Update PIN
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
