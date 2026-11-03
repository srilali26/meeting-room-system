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
  QrCode,
  ScrollText,
  Settings,
  Lock,
  LogOut,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Printer,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Room, Booking, BlockedSlot, DisplayScreen, AuditLog, AppSettings } from '@/types';
import { formatInDubai } from '@/lib/timezone';
import Link from 'next/link';

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
  | 'qrcodes'
  | 'audit'
  | 'settings';

export function AdminConsoleClient({ initialRooms, initialSettings }: AdminConsoleProps) {
  const router = useRouter();

  // Navigation State
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
  const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>([]);
  const [settings, setSettings] = React.useState<AppSettings>(initialSettings);
  const [stats, setStats] = React.useState<any>(null);

  // Filter States
  const [bookingFilterRoom, setBookingFilterRoom] = React.useState<string>('ALL');
  const [bookingSearch, setBookingSearch] = React.useState<string>('');

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
        fetch('/api/stats'),
      ]);

      if (rRes.ok) {
        const d = await rRes.json();
        setRooms(d.rooms);
      }
      if (bRes.ok) {
        const d = await bRes.json();
        setBookings(d.bookings);
      }
      if (blRes.ok) {
        const d = await blRes.json();
        setBlockedSlots(d.blocks);
      }
      if (scRes.ok) {
        const d = await scRes.json();
        setScreens(d.screens);
      }
      if (sRes.ok) {
        const d = await sRes.json();
        setSettings(d.settings);
      }
      if (stRes.ok) {
        const d = await stRes.json();
        setStats(d);
      }
    } catch (e) {
      console.error('Error fetching admin data', e);
    }
  }, []);

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/audit');
      if (res.ok) {
        const d = await res.json();
        setAuditLogs(d.logs);
      }
    } catch (e) {
      console.error('Error fetching audit logs', e);
    }
  };

  React.useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  React.useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  // Real-time SSE listener
  React.useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime');
      es.addEventListener('bookings', () => fetchAllData());
      es.addEventListener('blocked_slots', () => fetchAllData());
      es.addEventListener('rooms', () => fetchAllData());
      es.addEventListener('screens', () => fetchAllData());
      es.addEventListener('settings', () => fetchAllData());
    } catch (e) {
      // Ignored
    }
    return () => {
      if (es) es.close();
    };
  }, [fetchAllData]);

  // Inactivity Timer (15 minutes)
  React.useEffect(() => {
    let timeout: NodeJS.Timeout;
    const lockMinutes = settings.inactivity_lock_minutes || 15;

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsLocked(true);
      }, lockMinutes * 60 * 1000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [settings.inactivity_lock_minutes]);

  // PIN Unlock Handler
  const handleUnlockWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUnlocking(true);
    setPinError(null);

    try {
      const res = await fetch('/api/auth/unlock-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinError(data.error || 'Incorrect PIN');
      } else {
        setIsLocked(false);
        setPinInput('');
      }
    } catch (err: any) {
      setPinError('Error unlocking session');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignored
    }
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen bg-corporate-offwhite flex flex-col md:flex-row">
      {/* PIN Quick-Unlock Overlay */}
      {isLocked && (
        <div className="fixed inset-0 z-50 bg-corporate-navy/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-sm border border-corporate-hairline shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="w-12 h-12 bg-corporate-teal text-white rounded-sm flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-corporate-navy tracking-tight">Console Locked</h2>
            <p className="text-xs text-slate-500 mt-1 mb-6">
              Enter your 4-digit PIN to instantly resume your session.
            </p>

            <form onSubmit={handleUnlockWithPin} className="space-y-4">
              {pinError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-corporate-red text-xs rounded-sm font-semibold">
                  {pinError}
                </div>
              )}

              <input
                id="pin-unlock-input"
                type="password"
                maxLength={6}
                autoFocus
                placeholder="••••"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center text-3xl tracking-[0.5em] font-mono h-14 border border-corporate-hairline rounded-sm focus:outline-none focus:ring-2 focus:ring-corporate-teal"
              />

              <div className="grid grid-cols-3 gap-2 my-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'Clear', 0, 'Enter'].map((val, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (val === 'Clear') setPinInput('');
                      else if (val === 'Enter') handleUnlockWithPin({ preventDefault: () => {} } as any);
                      else if (pinInput.length < 6) setPinInput((prev) => prev + String(val));
                    }}
                    className="h-10 text-sm font-bold bg-corporate-offwhite hover:bg-slate-200 text-corporate-charcoal rounded-sm border border-corporate-hairline transition-colors"
                  >
                    {val}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="w-1/2 text-xs"
                >
                  Full Sign Out
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isUnlocking}
                  className="w-1/2 bg-corporate-navy"
                >
                  Unlock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deep Corporate Sidebar */}
      <aside className="w-full md:w-64 bg-corporate-navy text-white flex-shrink-0 flex flex-col justify-between border-r border-corporate-hairline shadow-md">
        <div>
          {/* App Title strictly 'Meeting Room Booking' */}
          <div className="p-6 border-b border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-teal-300">
              Receptionist Console
            </span>
            <h1 className="text-lg font-black tracking-tight text-white mt-0.5">
              Meeting Room Booking
            </h1>
            <p className="text-[11px] text-slate-300 mt-1 font-mono">192.168.50.143 (Internal)</p>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'schedule', label: "Today's Schedule", icon: CalendarDays },
              { id: 'bookings', label: 'All Bookings', icon: CalendarCheck2 },
              { id: 'rooms', label: 'Rooms & Capacity', icon: DoorClosed },
              { id: 'blocks', label: 'Blocked Slots', icon: ShieldBan },
              { id: 'screens', label: 'Display Screens', icon: Tv },
              { id: 'qrcodes', label: 'QR Signs (Print A4)', icon: QrCode },
              { id: 'audit', label: 'Audit Trail', icon: ScrollText },
              { id: 'settings', label: 'System Settings', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabKey)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-sm text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-corporate-teal text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-teal-300" />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <button
            onClick={() => setIsLocked(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock Console (PIN)</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium text-rose-300 hover:text-rose-100 hover:bg-rose-900/30 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top bar with quick status */}
        <header className="h-16 bg-white border-b border-corporate-hairline px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-corporate-navy uppercase tracking-wider">
              {activeTab === 'dashboard' && 'Operations Dashboard'}
              {activeTab === 'schedule' && "Today's Schedule Comparison"}
              {activeTab === 'bookings' && 'Reservations & Management'}
              {activeTab === 'rooms' && 'Meeting Rooms Configuration'}
              {activeTab === 'blocks' && 'Blocked & Maintenance Slots'}
              {activeTab === 'screens' && 'Wall-Mounted Display Screens'}
              {activeTab === 'qrcodes' && 'Room QR Codes & Printable Signs'}
              {activeTab === 'audit' && 'Security Audit Trail'}
              {activeTab === 'settings' && 'System Parameters & Security'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {notification && (
              <span className="text-xs bg-emerald-100 text-corporate-green px-3 py-1 rounded-sm border border-emerald-300 font-semibold animate-fade-in">
                {notification}
              </span>
            )}

            <Button variant="outline" size="sm" onClick={fetchAllData} title="Refresh data">
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Refresh
            </Button>

            <Link href="/" target="_blank">
              <Button variant="ghost" size="sm" className="text-xs text-slate-600">
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Public Directory
              </Button>
            </Link>
          </div>
        </header>

        {/* Dynamic Tab Body */}
        <div className="p-6">
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stat KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-sm border border-corporate-hairline shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total Rooms
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black text-corporate-navy">{rooms.length}</span>
                    <span className="text-xs text-corporate-green font-semibold">
                      {rooms.filter((r) => r.is_active).length} Active
                    </span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-sm border border-corporate-hairline shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Bookings Today
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black text-corporate-navy">
                      {stats?.bookingsToday ?? 0}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">Confirmed</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-sm border border-corporate-hairline shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Hours Reserved Today
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black text-corporate-teal">
                      {stats?.hoursBookedToday ?? 0} hrs
                    </span>
                    <span className="text-xs text-slate-500">of 12h workday</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-sm border border-corporate-hairline shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Facility Utilization
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black text-corporate-navy">
                      {stats?.utilizationPercentage ?? 0}%
                    </span>
                    <span className="text-xs text-corporate-teal font-semibold">Today</span>
                  </div>
                </div>
              </div>

              {/* Live Room Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-corporate-navy uppercase tracking-wider">
                    Live Facilities Overview
                  </h3>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setShowBookOnBehalfModal(true)}
                    className="bg-corporate-teal"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Book on Behalf
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rooms.map((room) => {
                    const roomOverview = stats?.roomsOverview?.find((o: any) => o.room.id === room.id);
                    const status = roomOverview?.status;
                    const isFree = status?.state === 'available';
                    const isOccupied = status?.state === 'occupied';
                    const isBlocked = status?.state === 'blocked';

                    return (
                      <div
                        key={room.id}
                        className="bg-white p-5 rounded-sm border border-corporate-hairline shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-base font-bold text-corporate-navy">{room.name}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">{room.location}</p>
                            </div>
                            <Badge
                              variant={isFree ? 'available' : isOccupied ? 'occupied' : 'unavailable'}
                            >
                              {isFree ? 'Available' : isOccupied ? 'Occupied' : 'Unavailable'}
                            </Badge>
                          </div>

                          <div
                            className={`p-3 rounded-xs text-xs mt-3 border ${
                              isFree
                                ? 'bg-emerald-50 border-emerald-200 text-corporate-green'
                                : isOccupied
                                ? 'bg-rose-50 border-rose-200 text-corporate-red'
                                : 'bg-slate-100 border-slate-200 text-slate-600'
                            }`}
                          >
                            <p className="font-semibold">{status?.bannerText || 'Checking status...'}</p>
                            {status?.nextMeetingSummary && (
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                {status.nextMeetingSummary}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-corporate-hairline flex items-center justify-between text-xs text-slate-600">
                          <span>Capacity: {room.capacity}</span>
                          <Link
                            href={`/room/${room.id}`}
                            target="_blank"
                            className="text-corporate-teal font-semibold hover:underline flex items-center gap-1"
                          >
                            Open Room <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TODAY'S SCHEDULE (SIDE-BY-SIDE) */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-sm border border-corporate-hairline">
                <div>
                  <h3 className="text-sm font-bold text-corporate-navy uppercase tracking-wider">
                    Multi-Room Daily Timeline
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comparing all {rooms.length} rooms simultaneously for today (Dubai Time UTC+4)
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> Free
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-corporate-red" /> Occupied
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-slate-400" /> Blocked
                  </span>
                </div>
              </div>

              {/* Side by side columns */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {rooms.map((room) => {
                  const roomBookings = bookings.filter((b) => b.room_id === room.id && b.status === 'confirmed');
                  return (
                    <div
                      key={room.id}
                      className="bg-white border border-corporate-hairline rounded-sm shadow-xs overflow-hidden"
                    >
                      <div className="p-3 bg-corporate-navy text-white text-center border-b border-corporate-navy">
                        <h4 className="text-xs font-bold uppercase tracking-wider">{room.name}</h4>
                        <span className="text-[10px] text-teal-300">Cap: {room.capacity}</span>
                      </div>
                      <div className="p-3 space-y-2 min-h-[360px] max-h-[600px] overflow-y-auto">
                        {roomBookings.length === 0 ? (
                          <div className="h-48 flex items-center justify-center text-center text-xs text-slate-400">
                            No meetings today. Entirely available.
                          </div>
                        ) : (
                          roomBookings.map((b) => (
                            <div
                              key={b.id}
                              className="p-2.5 rounded-xs bg-rose-50 border border-rose-200 text-corporate-charcoal text-xs shadow-2xs"
                            >
                              <span className="font-mono font-bold text-corporate-red block text-[11px]">
                                {formatInDubai(b.start_time, 'HH:mm')} – {formatInDubai(b.end_time, 'HH:mm')}
                              </span>
                              <span className="font-bold text-corporate-navy block line-clamp-1 mt-0.5">
                                {b.title}
                              </span>
                              <span className="text-[11px] text-slate-500 block truncate">
                                {b.organizer_name}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: BOOKINGS MANAGER */}
          {activeTab === 'bookings' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-sm border border-corporate-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={bookingFilterRoom}
                    onChange={(e) => setBookingFilterRoom(e.target.value)}
                    className="h-9 px-3 text-xs border border-corporate-hairline rounded-sm bg-white text-corporate-charcoal"
                  >
                    <option value="ALL">All Meeting Rooms</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search title, organizer..."
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                      className="h-9 w-full pl-9 pr-3 text-xs border border-corporate-hairline rounded-sm"
                    />
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setShowBookOnBehalfModal(true)}
                  className="bg-corporate-navy"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  + Book on Behalf
                </Button>
              </div>

              {/* Bookings Table */}
              <div className="bg-white border border-corporate-hairline rounded-sm shadow-xs overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-corporate-offwhite border-b border-corporate-hairline text-corporate-charcoal font-semibold uppercase tracking-wider text-[10px]">
                      <th className="p-3">Room</th>
                      <th className="p-3">Date & Time (Dubai)</th>
                      <th className="p-3">Meeting Title</th>
                      <th className="p-3">Organizer</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-corporate-hairline">
                    {bookings
                      .filter((b) => bookingFilterRoom === 'ALL' || b.room_id === bookingFilterRoom)
                      .filter(
                        (b) =>
                          b.title.toLowerCase().includes(bookingSearch.toLowerCase()) ||
                          b.organizer_name.toLowerCase().includes(bookingSearch.toLowerCase())
                      )
                      .map((b) => {
                        const roomObj = rooms.find((r) => r.id === b.room_id);
                        return (
                          <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-semibold text-corporate-navy">
                              {roomObj?.name || 'Unknown Room'}
                            </td>
                            <td className="p-3 font-mono text-corporate-charcoal">
                              <div>{formatInDubai(b.start_time, 'EEE, d MMM yyyy')}</div>
                              <div className="text-slate-500 text-[11px]">
                                {formatInDubai(b.start_time, 'HH:mm')} – {formatInDubai(b.end_time, 'HH:mm')}
                              </div>
                            </td>
                            <td className="p-3 font-medium text-corporate-charcoal">{b.title}</td>
                            <td className="p-3">
                              <div className="font-semibold">{b.organizer_name}</div>
                              <div className="text-slate-400 text-[10px]">{b.organizer_email}</div>
                            </td>
                            <td className="p-3">
                              <Badge variant={b.status === 'confirmed' ? 'available' : 'unavailable'}>
                                {b.status}
                              </Badge>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {b.status === 'confirmed' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingBooking(b);
                                        setShowEditBookingModal(true);
                                      }}
                                    >
                                      Edit / Move
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      onClick={async () => {
                                        if (confirm(`Cancel reservation "${b.title}"?`)) {
                                          const res = await fetch(`/api/bookings/${b.id}`, {
                                            method: 'DELETE',
                                          });
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
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: ROOMS MANAGER */}
          {activeTab === 'rooms' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-sm border border-corporate-hairline">
                <div>
                  <h3 className="text-sm font-bold text-corporate-navy uppercase tracking-wider">
                    Room Facilities Directory
                  </h3>
                  <p className="text-xs text-slate-500">
                    Add, edit capacity, or deactivate meeting spaces
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setShowAddRoomModal(true)}
                  className="bg-corporate-navy"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  + Add Room
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-white p-5 rounded-sm border border-corporate-hairline shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-base font-bold text-corporate-navy">{room.name}</h4>
                          <p className="text-xs text-slate-500">{room.location}</p>
                        </div>
                        <Badge variant={room.is_active ? 'available' : 'unavailable'}>
                          {room.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>

                      <div className="my-3 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Users className="w-3.5 h-3.5 text-corporate-teal" />
                          <span>Capacity: {room.capacity} Persons</span>
                        </div>
                        {room.amenities && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {room.amenities.map((a, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded-xs text-[10px] bg-slate-100 border border-slate-200"
                              >
                                {a}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-corporate-hairline flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingRoom(room);
                          setShowEditRoomModal(true);
                        }}
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        variant={room.is_active ? 'danger' : 'secondary'}
                        onClick={async () => {
                          const res = await fetch(`/api/rooms/${room.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ is_active: !room.is_active }),
                          });
                          if (res.ok) {
                            showNotify(`Room ${room.is_active ? 'deactivated' : 'activated'}`);
                            fetchAllData();
                          }
                        }}
                      >
                        {room.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: BLOCKED SLOTS */}
          {activeTab === 'blocks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-sm border border-corporate-hairline">
                <div>
                  <h3 className="text-sm font-bold text-corporate-navy uppercase tracking-wider">
                    Blocked Slots &amp; Maintenance
                  </h3>
                  <p className="text-xs text-slate-500">
                    Schedule recurring or one-off unavailability across facilities
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setShowAddBlockModal(true)}
                  className="bg-corporate-navy"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  + Block Time Slot
                </Button>
              </div>

              <div className="bg-white border border-corporate-hairline rounded-sm overflow-x-auto shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-corporate-offwhite border-b border-corporate-hairline text-corporate-charcoal uppercase tracking-wider text-[10px]">
                      <th className="p-3">Title / Reason</th>
                      <th className="p-3">Scope</th>
                      <th className="p-3">Rule / Period</th>
                      <th className="p-3">Created By</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-corporate-hairline">
                    {blockedSlots.map((b) => {
                      const targetRoom = b.room_id ? rooms.find((r) => r.id === b.room_id) : null;
                      return (
                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-bold text-corporate-navy">
                            {b.title}
                            {b.reason && <p className="text-slate-500 font-normal">{b.reason}</p>}
                          </td>
                          <td className="p-3">
                            <span className="font-semibold text-corporate-teal">
                              {targetRoom ? targetRoom.name : 'ALL 5 ROOMS'}
                            </span>
                          </td>
                          <td className="p-3 font-mono">
                            {b.recurring_rule === 'FRIDAY_12_14' ? (
                              <span className="text-corporate-red font-bold">
                                Recurring: Every Friday 12:00 – 14:00 (Prayer & Maintenance)
                              </span>
                            ) : (
                              <span>
                                {formatInDubai(b.start_time, 'd MMM HH:mm')} –{' '}
                                {formatInDubai(b.end_time, 'd MMM HH:mm')}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-slate-500">{b.created_by}</td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={async () => {
                                if (confirm(`Remove blocked slot "${b.title}"?`)) {
                                  const res = await fetch(`/api/blocks/${b.id}`, { method: 'DELETE' });
                                  if (res.ok) {
                                    showNotify('Blocked slot deleted');
                                    fetchAllData();
                                  }
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Remove
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: DISPLAY SCREENS */}
          {activeTab === 'screens' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-sm border border-corporate-hairline">
                <div>
                  <h3 className="text-sm font-bold text-corporate-navy uppercase tracking-wider">
                    Wall Tablet &amp; Kiosk Displays
                  </h3>
                  <p className="text-xs text-slate-500">
                    Monitor media player heartbeats and issue remote reload commands
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/display-test" target="_blank">
                    <Button size="sm" variant="outline">
                      Diagnostic Test
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setShowRegisterScreenModal(true)}
                    className="bg-corporate-navy"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    + Register Screen
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {screens.map((screen) => {
                  const targetRoom = rooms.find((r) => r.id === screen.room_id);
                  return (
                    <div
                      key={screen.id}
                      className="bg-white p-5 rounded-sm border border-corporate-hairline shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-corporate-navy">{screen.name}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Room: <span className="font-semibold">{targetRoom?.name}</span>
                            </p>
                          </div>
                          <Badge variant={screen.is_online ? 'available' : 'unavailable'}>
                            <span
                              className={`w-2 h-2 rounded-full mr-1 ${
                                screen.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                              }`}
                            />
                            {screen.is_online ? 'Online' : 'Offline'}
                          </Badge>
                        </div>

                        <div className="my-3 space-y-1 text-xs text-slate-600 font-mono">
                          <div>IP: {screen.media_player_ip || 'DHCP (Awaiting heartbeat)'}</div>
                          <div>Orientation: {screen.orientation}</div>
                          <div>
                            Heartbeat:{' '}
                            {screen.last_heartbeat_at
                              ? formatInDubai(screen.last_heartbeat_at, 'HH:mm:ss')
                              : 'None'}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-corporate-hairline flex items-center justify-between gap-2">
                        <Link href={`/display/${screen.room_id}`} target="_blank">
                          <Button size="sm" variant="outline">
                            Preview Display
                          </Button>
                        </Link>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            const res = await fetch(`/api/screens/${screen.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'reload' }),
                            });
                            if (res.ok) {
                              showNotify('Remote reload command issued to display');
                            }
                          }}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Reload
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 7: QR SIGNS */}
          {activeTab === 'qrcodes' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-sm border border-corporate-hairline">
                <h3 className="text-sm font-bold text-corporate-navy uppercase tracking-wider">
                  Room QR Signs (Printable A4 / Tabloid)
                </h3>
                <p className="text-xs text-slate-500">
                  Print official signage to place outside each meeting room. Each sign directs
                  smartphones to http://192.168.50.143/room/&#123;roomId&#125;.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-white p-6 rounded-sm border border-corporate-hairline shadow-xs flex flex-col items-center text-center justify-between"
                  >
                    <div className="w-full">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Official Signage
                      </span>
                      <h4 className="text-lg font-black text-corporate-navy mt-1">{room.name}</h4>
                      <p className="text-xs text-slate-500">{room.location}</p>

                      <div className="my-6 p-4 bg-white border border-corporate-hairline rounded-sm inline-block shadow-2xs">
                        <img
                          src={`/api/rooms/${room.id}?date=today`}
                          alt=""
                          className="hidden"
                        />
                        <div className="w-40 h-40 flex items-center justify-center bg-slate-50 border border-slate-200">
                          <QrCode className="w-24 h-24 text-corporate-navy" />
                        </div>
                      </div>

                      <p className="text-[11px] font-mono text-slate-600">
                        http://192.168.50.143/room/{room.id}
                      </p>
                    </div>

                    <div className="w-full pt-4 border-t border-corporate-hairline mt-4">
                      <Link href={`/room/${room.id}/print`} target="_blank" className="w-full block">
                        <Button variant="primary" size="sm" className="w-full bg-corporate-navy">
                          <Printer className="w-3.5 h-3.5 mr-1.5" />
                          Print A4 Sign
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-sm border border-corporate-hairline">
                <div>
                  <h3 className="text-sm font-bold text-corporate-navy uppercase tracking-wider">
                    Security Audit Trail
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chronological activity log recorded on the local Windows Server
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={fetchAuditLogs}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Refresh Logs
                </Button>
              </div>

              <div className="bg-white border border-corporate-hairline rounded-sm overflow-x-auto shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-corporate-offwhite border-b border-corporate-hairline text-corporate-charcoal uppercase tracking-wider text-[10px]">
                      <th className="p-3">Timestamp (Dubai)</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Actor</th>
                      <th className="p-3">IP Address</th>
                      <th className="p-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-corporate-hairline font-mono text-[11px]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-500">
                          {formatInDubai(log.created_at, 'yyyy-MM-dd HH:mm:ss')}
                        </td>
                        <td className="p-3 font-bold text-corporate-navy">{log.action}</td>
                        <td className="p-3 font-semibold text-corporate-teal">{log.actor}</td>
                        <td className="p-3 text-slate-600">{log.ip_address}</td>
                        <td className="p-3 text-slate-600 max-w-md truncate font-sans text-xs">
                          {typeof log.details === 'object'
                            ? JSON.stringify(log.details)
                            : log.details || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 9: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl bg-white p-6 rounded-sm border border-corporate-hairline shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-corporate-navy">System Configuration</h3>
                <p className="text-xs text-slate-500">
                  Control facility hours, slot lengths, and security controls
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between p-3 bg-corporate-offwhite rounded-sm border border-corporate-hairline">
                  <div>
                    <span className="font-bold text-corporate-charcoal block">
                      Operating Working Hours
                    </span>
                    <span className="text-slate-500">
                      Standard availability window for timeline bookings
                    </span>
                  </div>
                  <span className="font-mono font-bold text-corporate-navy">
                    {settings.work_start_hour}:00 – {settings.work_end_hour}:00 (Dubai Time)
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-corporate-offwhite rounded-sm border border-corporate-hairline">
                  <div>
                    <span className="font-bold text-corporate-charcoal block">Timeline Slot Length</span>
                    <span className="text-slate-500">Fixed reservation increment</span>
                  </div>
                  <span className="font-mono font-bold text-corporate-navy">
                    {settings.slot_duration_minutes} minutes
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-corporate-offwhite rounded-sm border border-corporate-hairline">
                  <div>
                    <span className="font-bold text-corporate-charcoal block">Privacy Mode</span>
                    <span className="text-slate-500">
                      Mask meeting titles and employee names as &apos;Booked&apos; for public visitors
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={settings.privacy_mode ? 'primary' : 'outline'}
                    onClick={async () => {
                      const res = await fetch('/api/settings', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ privacy_mode: !settings.privacy_mode }),
                      });
                      if (res.ok) {
                        setSettings((prev) => ({ ...prev, privacy_mode: !prev.privacy_mode }));
                        showNotify('Privacy mode updated');
                      }
                    }}
                  >
                    {settings.privacy_mode ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-corporate-offwhite rounded-sm border border-corporate-hairline">
                  <div>
                    <span className="font-bold text-corporate-charcoal block">
                      Console Inactivity Lock
                    </span>
                    <span className="text-slate-500">
                      Require quick PIN unlock after idle timeout
                    </span>
                  </div>
                  <span className="font-mono font-bold text-corporate-navy">
                    {settings.inactivity_lock_minutes} minutes
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-corporate-hairline flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowChangePasswordModal(true)}
                >
                  Change Admin Password
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowChangePinModal(true)}
                >
                  Update Quick PIN
                </Button>
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
        description="Creates a new facility and generates permanent URL and QR code."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const name = (form.elements.namedItem('room_name') as HTMLInputElement).value;
            const location = (form.elements.namedItem('room_location') as HTMLInputElement).value;
            const capacity = parseInt(
              (form.elements.namedItem('room_capacity') as HTMLInputElement).value,
              10
            );
            const amenitiesStr = (
              form.elements.namedItem('room_amenities') as HTMLInputElement
            ).value;
            const amenities = amenitiesStr
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);

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
          <Input
            id="add-room-name"
            name="room_name"
            label="Room Name"
            placeholder="e.g. Meeting Room 6"
            defaultValue={`Meeting Room ${rooms.length + 1}`}
            required
          />
          <Input
            id="add-room-location"
            name="room_location"
            label="Location / Floor"
            placeholder="e.g. Floor 4, Innovation Wing"
            required
          />
          <Input
            id="add-room-capacity"
            name="room_capacity"
            label="Seating Capacity"
            type="number"
            min={1}
            defaultValue={8}
            required
          />
          <Input
            id="add-room-amenities"
            name="room_amenities"
            label="Amenities (Comma Separated)"
            placeholder="4K Screen, Video Bar, Whiteboard"
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-corporate-hairline">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAddRoomModal(false)}
            >
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
              const capacity = parseInt(
                (form.elements.namedItem('edit_capacity') as HTMLInputElement).value,
                10
              );
              const amenitiesStr = (
                form.elements.namedItem('edit_amenities') as HTMLInputElement
              ).value;
              const amenities = amenitiesStr
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

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
            <Input
              id="edit-room-name"
              name="edit_name"
              label="Room Name"
              defaultValue={editingRoom.name}
              required
            />
            <Input
              id="edit-room-location"
              name="edit_location"
              label="Location"
              defaultValue={editingRoom.location}
              required
            />
            <Input
              id="edit-room-capacity"
              name="edit_capacity"
              label="Capacity"
              type="number"
              defaultValue={editingRoom.capacity}
              required
            />
            <Input
              id="edit-room-amenities"
              name="edit_amenities"
              label="Amenities"
              defaultValue={editingRoom.amenities?.join(', ')}
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-corporate-hairline">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowEditRoomModal(false)}
              >
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
        description="Schedule a meeting for an executive or team."
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

            // Form UTC strings from Dubai inputs
            const [sH, sM] = startTimeStr.split(':').map(Number);
            const [eH, eM] = endTimeStr.split(':').map(Number);
            const [y, m, d] = date.split('-').map(Number);

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
            if (!res.ok) {
              alert(data.error || 'Failed to create booking');
            } else {
              showNotify('Reservation created on behalf');
              setShowBookOnBehalfModal(false);
              fetchAllData();
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold uppercase text-corporate-charcoal mb-1">
              Select Room
            </label>
            <select
              name="bob_room"
              required
              className="w-full h-10 px-3 text-xs border border-corporate-hairline rounded-sm bg-white"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.location})
                </option>
              ))}
            </select>
          </div>

          <Input
            id="bob-title"
            name="bob_title"
            label="Meeting Title"
            placeholder="Executive Board Sync"
            required
          />
          <Input
            id="bob-name"
            name="bob_name"
            label="Organizer Full Name"
            placeholder="Elena Rostova"
            required
          />
          <Input
            id="bob-email"
            name="bob_email"
            label="Organizer Work Email"
            type="email"
            placeholder="elena.r@company.internal"
            required
          />

          <div className="grid grid-cols-3 gap-2">
            <Input
              id="bob-date"
              name="bob_date"
              label="Date"
              type="date"
              defaultValue={formatInDubai(new Date(), 'yyyy-MM-dd')}
              required
            />
            <Input id="bob-start" name="bob_start" label="Start Time" type="time" defaultValue="10:00" required />
            <Input id="bob-end" name="bob_end" label="End Time" type="time" defaultValue="11:00" required />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-corporate-hairline">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowBookOnBehalfModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="bg-corporate-navy">
              Confirm Reservation
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: BLOCK TIME SLOT */}
      <Modal
        isOpen={showAddBlockModal}
        onClose={() => setShowAddBlockModal(false)}
        title="Block Facility Time Slot"
        description="Prevents employees from booking slots during maintenance, inspections, or breaks."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const room_id = (form.elements.namedItem('block_room') as HTMLSelectElement).value || null;
            const title = (form.elements.namedItem('block_title') as HTMLInputElement).value;
            const isRecurringFriday = (
              form.elements.namedItem('block_recurring') as HTMLInputElement
            ).checked;

            let bodyPayload: any = {
              room_id: room_id === 'ALL' ? null : room_id,
              title,
            };

            if (isRecurringFriday) {
              bodyPayload.recurring_rule = 'FRIDAY_12_14';
              bodyPayload.start_time = new Date().toISOString();
              bodyPayload.end_time = new Date(Date.now() + 365 * 86400000).toISOString();
            } else {
              const date = (form.elements.namedItem('block_date') as HTMLInputElement).value;
              const startT = (form.elements.namedItem('block_start') as HTMLInputElement).value;
              const endT = (form.elements.namedItem('block_end') as HTMLInputElement).value;
              const [sH, sM] = startT.split(':').map(Number);
              const [eH, eM] = endT.split(':').map(Number);
              const [y, m, d] = date.split('-').map(Number);
              bodyPayload.start_time = new Date(Date.UTC(y, m - 1, d, sH - 4, sM)).toISOString();
              bodyPayload.end_time = new Date(Date.UTC(y, m - 1, d, eH - 4, eM)).toISOString();
            }

            const res = await fetch('/api/blocks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(bodyPayload),
            });

            const data = await res.json();
            if (!res.ok) {
              alert(data.error || 'Failed to block slot');
            } else {
              if (data.warning) {
                alert(`Warning: ${data.warning}`);
              }
              showNotify('Facility slot blocked successfully');
              setShowAddBlockModal(false);
              fetchAllData();
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold uppercase text-corporate-charcoal mb-1">
              Target Facility
            </label>
            <select
              name="block_room"
              className="w-full h-10 px-3 text-xs border border-corporate-hairline rounded-sm bg-white"
            >
              <option value="ALL">Apply to ALL 5 Meeting Rooms</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            id="block-title"
            name="block_title"
            label="Block Reason"
            placeholder="e.g. Projector Replacement / AC Service"
            required
          />

          <div className="p-3 bg-corporate-offwhite border border-corporate-hairline rounded-sm">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input type="checkbox" name="block_recurring" defaultChecked={false} className="w-4 h-4" />
              <span>Recurring Friday Prayer (12:00 – 14:00 Dubai Time)</span>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Input
              id="block-date"
              name="block_date"
              label="Date"
              type="date"
              defaultValue={formatInDubai(new Date(), 'yyyy-MM-dd')}
            />
            <Input id="block-start" name="block_start" label="Start Time" type="time" defaultValue="12:00" />
            <Input id="block-end" name="block_end" label="End Time" type="time" defaultValue="14:00" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-corporate-hairline">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAddBlockModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="bg-corporate-navy">
              Block Slot
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: REGISTER DISPLAY SCREEN */}
      <Modal
        isOpen={showRegisterScreenModal}
        onClose={() => setShowRegisterScreenModal(false)}
        title="Register Wall Display Screen"
        description="Connect a tablet or media player outside a room."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const name = (form.elements.namedItem('screen_name') as HTMLInputElement).value;
            const room_id = (form.elements.namedItem('screen_room') as HTMLSelectElement).value;
            const orientation = (form.elements.namedItem('screen_orientation') as HTMLSelectElement)
              .value;

            const res = await fetch('/api/screens', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, room_id, orientation }),
            });

            if (res.ok) {
              showNotify('Display screen registered');
              setShowRegisterScreenModal(false);
              fetchAllData();
            }
          }}
          className="space-y-4"
        >
          <Input
            id="screen-name"
            name="screen_name"
            label="Display Device Name"
            placeholder="e.g. Meeting Room 1 Wall Tablet"
            required
          />
          <div>
            <label className="block text-xs font-semibold uppercase text-corporate-charcoal mb-1">
              Mounted Outside Room
            </label>
            <select
              name="screen_room"
              required
              className="w-full h-10 px-3 text-xs border border-corporate-hairline rounded-sm bg-white"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-corporate-charcoal mb-1">
              Screen Orientation
            </label>
            <select
              name="screen_orientation"
              defaultValue="landscape"
              className="w-full h-10 px-3 text-xs border border-corporate-hairline rounded-sm bg-white"
            >
              <option value="landscape">Landscape (16:9)</option>
              <option value="portrait">Portrait (9:16)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-corporate-hairline">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowRegisterScreenModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="bg-corporate-navy">
              Register Screen
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CHANGE PASSWORD */}
      <Modal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        title="Update Receptionist Admin Password"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const current_password = (
              form.elements.namedItem('curr_pass') as HTMLInputElement
            ).value;
            const new_password = (form.elements.namedItem('new_pass') as HTMLInputElement).value;

            const res = await fetch('/api/auth/change-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ current_password, new_password }),
            });
            const data = await res.json();
            if (!res.ok) {
              alert(data.error || 'Failed to update password');
            } else {
              showNotify('Password updated successfully');
              setShowChangePasswordModal(false);
            }
          }}
          className="space-y-4"
        >
          <Input
            id="curr-pass"
            name="curr_pass"
            label="Current Password"
            type="password"
            required
          />
          <Input
            id="new-pass"
            name="new_pass"
            label="New Password (min 8 chars)"
            type="password"
            required
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-corporate-hairline">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowChangePasswordModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="bg-corporate-navy">
              Save Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CHANGE PIN */}
      <Modal
        isOpen={showChangePinModal}
        onClose={() => setShowChangePinModal(false)}
        title="Update Quick Console PIN"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const current_password = (
              form.elements.namedItem('pin_curr_pass') as HTMLInputElement
            ).value;
            const new_pin = (form.elements.namedItem('pin_new') as HTMLInputElement).value;

            const res = await fetch('/api/auth/change-pin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ current_password, new_pin }),
            });
            const data = await res.json();
            if (!res.ok) {
              alert(data.error || 'Failed to update PIN');
            } else {
              showNotify('Quick PIN updated successfully');
              setShowChangePinModal(false);
            }
          }}
          className="space-y-4"
        >
          <Input
            id="pin-curr-pass"
            name="pin_curr_pass"
            label="Current Admin Password"
            type="password"
            required
          />
          <Input
            id="pin-new"
            name="pin_new"
            label="New PIN (4 to 6 Digits)"
            type="password"
            maxLength={6}
            placeholder="1234"
            required
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-corporate-hairline">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowChangePinModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="bg-corporate-navy">
              Save PIN
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
