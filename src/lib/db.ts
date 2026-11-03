import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  Room,
  Booking,
  BlockedSlot,
  AdminUser,
  AdminSession,
  DisplayScreen,
  AuditLog,
  AppSettings,
} from '@/types';
import {
  formatInDubai,
  createDubaiDateTime,
  DEFAULT_SETTINGS,
  computeRoomStatus,
} from './timezone';
import { parseISO, isBefore, isAfter, addDays } from 'date-fns';

// ---------------------------------------------------------------------------
// In-Memory SSE Event Hub (Zero-latency push to connected clients)
// ---------------------------------------------------------------------------
export type RealtimeEvent = {
  table: 'bookings' | 'blocked_slots' | 'rooms' | 'screens' | 'settings';
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'RELOAD';
  data?: any;
  id?: string;
};

type Listener = (event: RealtimeEvent) => void;
const listeners = new Set<Listener>();

export function subscribeToRealtime(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function broadcastRealtimeEvent(event: RealtimeEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (e) {
      // Ignored for dead clients
    }
  });
}

// ---------------------------------------------------------------------------
// Seed Data: 5 Default Meeting Rooms
// ---------------------------------------------------------------------------
const SEED_ROOMS: Room[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Meeting Room 1',
    location: 'Floor 1, Main Wing',
    capacity: 16,
    amenities: ['4K Dual Display', 'Video Conferencing Kit', 'Conference Phone', 'Digital Whiteboard', 'High-speed Wi-Fi'],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Meeting Room 2',
    location: 'Floor 2, East Wing',
    capacity: 8,
    amenities: ['Touchscreen Smart Board', 'Video Conferencing', 'Modular Desks', 'Wireless Presentation'],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Meeting Room 3',
    location: 'Floor 2, Quiet Zone',
    capacity: 4,
    amenities: ['Ultra-wide Monitor', 'Acoustic Soundproofing', 'Ergonomic Seating', 'High-speed Wi-Fi'],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Meeting Room 4',
    location: 'Floor 3, West Wing',
    capacity: 10,
    amenities: ['4K Display', 'Video Bar', 'Whiteboard', 'Conference Table'],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    name: 'Meeting Room 5',
    location: 'Floor 3, Collaboration Hub',
    capacity: 6,
    amenities: ['Touchscreen TV', 'Modular Seating', 'Wireless Screen Mirroring'],
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

const SEED_SCREENS: DisplayScreen[] = [
  {
    id: 'd1111111-1111-1111-1111-111111111111',
    name: 'Meeting Room 1 Display',
    room_id: '11111111-1111-1111-1111-111111111111',
    media_player_ip: '192.168.50.201',
    orientation: 'landscape',
    display_token: 'token-screen-room-1',
    last_heartbeat_at: new Date().toISOString(),
    is_online: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'd2222222-2222-2222-2222-222222222222',
    name: 'Meeting Room 2 Display',
    room_id: '22222222-2222-2222-2222-222222222222',
    media_player_ip: '192.168.50.202',
    orientation: 'landscape',
    display_token: 'token-screen-room-2',
    last_heartbeat_at: new Date().toISOString(),
    is_online: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'd3333333-3333-3333-3333-333333333333',
    name: 'Meeting Room 3 Display',
    room_id: '33333333-3333-3333-3333-333333333333',
    media_player_ip: '192.168.50.203',
    orientation: 'portrait',
    display_token: 'token-screen-room-3',
    last_heartbeat_at: new Date().toISOString(),
    is_online: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'd4444444-4444-4444-4444-444444444444',
    name: 'Meeting Room 4 Display',
    room_id: '44444444-4444-4444-4444-444444444444',
    media_player_ip: '192.168.50.204',
    orientation: 'landscape',
    display_token: 'token-screen-room-4',
    last_heartbeat_at: new Date().toISOString(),
    is_online: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'd5555555-5555-5555-5555-555555555555',
    name: 'Meeting Room 5 Display',
    room_id: '55555555-5555-5555-5555-555555555555',
    media_player_ip: '192.168.50.205',
    orientation: 'landscape',
    display_token: 'token-screen-room-5',
    last_heartbeat_at: new Date().toISOString(),
    is_online: true,
    created_at: new Date().toISOString(),
  },
];

const SEED_BLOCKS: BlockedSlot[] = [
  {
    id: 'bbbb0000-0000-0000-0000-000000000001',
    room_id: null, // applies to all rooms
    title: 'Friday Prayer & Building Maintenance',
    reason: 'Regular weekly maintenance and Friday prayer break across all meeting rooms',
    start_time: new Date().toISOString(),
    end_time: addDays(new Date(), 365).toISOString(),
    recurring_rule: 'FRIDAY_12_14',
    created_by: 'admin',
    created_at: new Date().toISOString(),
  },
];

function getInitialBookings(): Booking[] {
  const todayStr = formatInDubai(new Date(), 'yyyy-MM-dd');
  return [
    {
      id: 'b1111111-1111-1111-1111-111111111111',
      room_id: '11111111-1111-1111-1111-111111111111',
      title: 'Quarterly Strategy Alignment',
      organizer_name: 'Sarah Al Mansoor',
      organizer_email: 'sarah.mansoor@example.com',
      start_time: createDubaiDateTime(todayStr, 9, 0).toISOString(),
      end_time: createDubaiDateTime(todayStr, 10, 30).toISOString(),
      notes: 'In-person presentation and leadership sync.',
      cancel_token: 'token-sample-sarah-1',
      status: 'confirmed',
      created_at: new Date().toISOString(),
    },
    {
      id: 'b2222222-2222-2222-2222-222222222222',
      room_id: '11111111-1111-1111-1111-111111111111',
      title: 'Operations Review',
      organizer_name: 'Tariq Mahmoud',
      organizer_email: 'tariq.m@example.com',
      start_time: createDubaiDateTime(todayStr, 14, 0).toISOString(),
      end_time: createDubaiDateTime(todayStr, 15, 30).toISOString(),
      notes: 'Monthly KPIs and logistics roadmap.',
      cancel_token: 'token-sample-tariq-2',
      status: 'confirmed',
      created_at: new Date().toISOString(),
    },
    {
      id: 'b3333333-3333-3333-3333-333333333333',
      room_id: '22222222-2222-2222-2222-222222222222',
      title: 'Design Sprint Workshop',
      organizer_name: 'Elena Rostova',
      organizer_email: 'elena.r@example.com',
      start_time: createDubaiDateTime(todayStr, 11, 0).toISOString(),
      end_time: createDubaiDateTime(todayStr, 12, 30).toISOString(),
      notes: 'User flow prototyping.',
      cancel_token: 'token-sample-elena-3',
      status: 'confirmed',
      created_at: new Date().toISOString(),
    },
  ];
}

// ---------------------------------------------------------------------------
// In-Memory Persistent Store on globalThis
// ---------------------------------------------------------------------------
interface DataStore {
  rooms: Room[];
  bookings: Booking[];
  blockedSlots: BlockedSlot[];
  displayScreens: DisplayScreen[];
  adminUser: AdminUser | null;
  sessions: AdminSession[];
  auditLogs: AuditLog[];
  settings: AppSettings;
}

const g = globalThis as unknown as { __MEETING_ROOM_STORE__?: DataStore };

if (!g.__MEETING_ROOM_STORE__) {
  // Default admin: username "admin", password "admin123" (bcrypt hash), PIN "1234"
  const defaultPasswordHash = bcrypt.hashSync('admin123', 10);
  const defaultPinHash = bcrypt.hashSync('1234', 10);

  g.__MEETING_ROOM_STORE__ = {
    rooms: [...SEED_ROOMS],
    bookings: getInitialBookings(),
    blockedSlots: [...SEED_BLOCKS],
    displayScreens: [...SEED_SCREENS],
    adminUser: {
      id: 'a0000000-0000-0000-0000-000000000001',
      username: 'admin',
      password_hash: defaultPasswordHash,
      pin_hash: defaultPinHash,
      failed_attempts: 0,
      locked_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    sessions: [],
    auditLogs: [
      {
        id: crypto.randomUUID(),
        action: 'SYSTEM_INIT',
        actor: 'system',
        ip_address: '127.0.0.1',
        details: { message: 'Meeting room system initialized' },
        created_at: new Date().toISOString(),
      },
    ],
    settings: { ...DEFAULT_SETTINGS },
  };
}

const store = g.__MEETING_ROOM_STORE__;

// ---------------------------------------------------------------------------
// Database API Class
// ---------------------------------------------------------------------------
export class Database {
  // -------------------------
  // Rooms
  // -------------------------
  static async getRooms(): Promise<Room[]> {
    return [...store.rooms].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  static async getRoomById(id: string): Promise<Room | null> {
    return store.rooms.find((r) => r.id === id) || null;
  }

  static async createRoom(data: Omit<Room, 'id' | 'created_at'>): Promise<Room> {
    const room: Room = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    store.rooms.push(room);
    broadcastRealtimeEvent({ table: 'rooms', action: 'INSERT', data: room });
    return room;
  }

  static async updateRoom(id: string, updates: Partial<Room>): Promise<Room | null> {
    const idx = store.rooms.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    store.rooms[idx] = { ...store.rooms[idx], ...updates };
    broadcastRealtimeEvent({ table: 'rooms', action: 'UPDATE', data: store.rooms[idx] });
    return store.rooms[idx];
  }

  static suggestNextRoomName(): string {
    const numbers = store.rooms
      .map((r) => {
        const match = r.name.match(/Meeting Room (\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const max = numbers.length > 0 ? Math.max(...numbers) : 5;
    return `Meeting Room ${max + 1}`;
  }

  // -------------------------
  // Bookings
  // -------------------------
  static async getBookings(roomId?: string, dateStr?: string): Promise<Booking[]> {
    let list = [...store.bookings];
    if (roomId) {
      list = list.filter((b) => b.room_id === roomId);
    }
    if (dateStr) {
      const dayStart = createDubaiDateTime(dateStr, 0, 0);
      const dayEnd = createDubaiDateTime(dateStr, 23, 59);
      list = list.filter((b) => {
        const bStart = parseISO(b.start_time);
        const bEnd = parseISO(b.end_time);
        return isBefore(dayStart, bEnd) && isAfter(dayEnd, bStart);
      });
    }
    return list.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }

  static async getBookingById(id: string): Promise<Booking | null> {
    return store.bookings.find((b) => b.id === id) || null;
  }

  static async getBookingByCancelToken(token: string): Promise<Booking | null> {
    return store.bookings.find((b) => b.cancel_token === token) || null;
  }

  static async createBooking(dto: {
    room_id: string;
    title: string;
    organizer_name: string;
    organizer_email: string;
    start_time: string;
    end_time: string;
    notes?: string | null;
  }): Promise<Booking> {
    const newStart = parseISO(dto.start_time);
    const newEnd = parseISO(dto.end_time);

    // 1. Check if room is active
    const room = await this.getRoomById(dto.room_id);
    if (!room || !room.is_active) {
      throw new Error('This meeting room is inactive and cannot be booked.');
    }

    // 2. Check if slot overlaps with any blocked slot
    const blocked = await this.getBlockedSlots(dto.room_id);
    const isBlocked = blocked.some((block) => {
      if (block.recurring_rule === 'FRIDAY_12_14') {
        const day = formatInDubai(newStart, 'EEEE');
        const h = parseInt(formatInDubai(newStart, 'H'), 10);
        if (day === 'Friday' && h >= 12 && h < 14) return true;
      }
      const bStart = parseISO(block.start_time);
      const bEnd = parseISO(block.end_time);
      return isBefore(newStart, bEnd) && isAfter(newEnd, bStart);
    });

    if (isBlocked) {
      const err = new Error('This time slot is blocked and unavailable for booking.');
      (err as any).code = 'SLOT_BLOCKED';
      throw err;
    }

    // 3. Check database-level exclusion overlap constraint
    const confirmedBookings = store.bookings.filter(
      (b) => b.room_id === dto.room_id && b.status === 'confirmed'
    );

    const hasOverlap = confirmedBookings.some((b) => {
      const bStart = parseISO(b.start_time);
      const bEnd = parseISO(b.end_time);
      return isBefore(newStart, bEnd) && isAfter(newEnd, bStart);
    });

    if (hasOverlap) {
      const err = new Error('This slot was just taken, please pick another.');
      (err as any).code = '23P01'; // Matches Postgres exclusion violation
      throw err;
    }

    const booking: Booking = {
      id: crypto.randomUUID(),
      room_id: dto.room_id,
      title: dto.title,
      organizer_name: dto.organizer_name,
      organizer_email: dto.organizer_email,
      start_time: dto.start_time,
      end_time: dto.end_time,
      notes: dto.notes || null,
      cancel_token: crypto.randomBytes(16).toString('hex'),
      status: 'confirmed',
      created_at: new Date().toISOString(),
    };

    store.bookings.push(booking);
    broadcastRealtimeEvent({ table: 'bookings', action: 'INSERT', data: booking });
    return booking;
  }

  static async updateBooking(id: string, updates: Partial<Booking>): Promise<Booking | null> {
    const idx = store.bookings.findIndex((b) => b.id === id);
    if (idx === -1) return null;

    // If changing time or room, verify overlap
    if ((updates.start_time || updates.end_time || updates.room_id) && updates.status !== 'cancelled') {
      const newRoom = updates.room_id || store.bookings[idx].room_id;
      const newStart = parseISO(updates.start_time || store.bookings[idx].start_time);
      const newEnd = parseISO(updates.end_time || store.bookings[idx].end_time);

      const conflicts = store.bookings.filter(
        (b) => b.id !== id && b.room_id === newRoom && b.status === 'confirmed'
      );
      const hasOverlap = conflicts.some((b) => {
        const bStart = parseISO(b.start_time);
        const bEnd = parseISO(b.end_time);
        return isBefore(newStart, bEnd) && isAfter(newEnd, bStart);
      });

      if (hasOverlap) {
        const err = new Error('The updated time slot overlaps with an existing booking.');
        (err as any).code = '23P01';
        throw err;
      }
    }

    store.bookings[idx] = { ...store.bookings[idx], ...updates };
    broadcastRealtimeEvent({ table: 'bookings', action: 'UPDATE', data: store.bookings[idx] });
    return store.bookings[idx];
  }

  static async cancelBookingByToken(token: string): Promise<Booking> {
    const booking = store.bookings.find((b) => b.cancel_token === token);
    if (!booking) {
      throw new Error('Invalid cancellation token or booking not found.');
    }
    booking.status = 'cancelled';
    broadcastRealtimeEvent({ table: 'bookings', action: 'UPDATE', data: booking });
    return booking;
  }

  static async adminCancelBooking(id: string): Promise<Booking> {
    const booking = store.bookings.find((b) => b.id === id);
    if (!booking) {
      throw new Error('Booking not found.');
    }
    booking.status = 'cancelled';
    broadcastRealtimeEvent({ table: 'bookings', action: 'UPDATE', data: booking });
    return booking;
  }

  // -------------------------
  // Blocked Slots
  // -------------------------
  static async getBlockedSlots(roomId?: string): Promise<BlockedSlot[]> {
    let list = [...store.blockedSlots];
    if (roomId) {
      list = list.filter((b) => b.room_id === null || b.room_id === roomId);
    }
    return list;
  }

  static async createBlockedSlot(dto: {
    room_id?: string | null;
    title: string;
    reason?: string | null;
    start_time: string;
    end_time: string;
    recurring_rule?: string | null;
  }): Promise<{ blockedSlot: BlockedSlot; affectedBookingsCount: number }> {
    const newStart = parseISO(dto.start_time);
    const newEnd = parseISO(dto.end_time);

    // Find if any confirmed bookings will be affected
    const affected = store.bookings.filter((b) => {
      if (b.status !== 'confirmed') return false;
      if (dto.room_id && b.room_id !== dto.room_id) return false;
      const bStart = parseISO(b.start_time);
      const bEnd = parseISO(b.end_time);
      return isBefore(newStart, bEnd) && isAfter(newEnd, bStart);
    });

    const blocked: BlockedSlot = {
      id: crypto.randomUUID(),
      room_id: dto.room_id || null,
      title: dto.title,
      reason: dto.reason || null,
      start_time: dto.start_time,
      end_time: dto.end_time,
      recurring_rule: dto.recurring_rule || null,
      created_by: 'admin',
      created_at: new Date().toISOString(),
    };

    store.blockedSlots.push(blocked);
    broadcastRealtimeEvent({ table: 'blocked_slots', action: 'INSERT', data: blocked });
    return { blockedSlot: blocked, affectedBookingsCount: affected.length };
  }

  static async deleteBlockedSlot(id: string): Promise<boolean> {
    const idx = store.blockedSlots.findIndex((b) => b.id === id);
    if (idx === -1) return false;
    store.blockedSlots.splice(idx, 1);
    broadcastRealtimeEvent({ table: 'blocked_slots', action: 'DELETE', id });
    return true;
  }

  // -------------------------
  // Display Screens
  // -------------------------
  static async getDisplayScreens(): Promise<DisplayScreen[]> {
    const now = Date.now();
    return store.displayScreens.map((s) => {
      const last = s.last_heartbeat_at ? new Date(s.last_heartbeat_at).getTime() : 0;
      const isOnline = now - last < 90000; // online if heartbeat within 90s
      return { ...s, is_online: isOnline };
    });
  }

  static async getDisplayScreenByToken(token: string): Promise<DisplayScreen | null> {
    const screen = store.displayScreens.find((s) => s.display_token === token);
    return screen || null;
  }

  static async registerDisplayScreen(data: {
    name: string;
    room_id: string;
    media_player_ip?: string | null;
    orientation: 'landscape' | 'portrait';
  }): Promise<DisplayScreen> {
    const screen: DisplayScreen = {
      id: crypto.randomUUID(),
      name: data.name,
      room_id: data.room_id,
      media_player_ip: data.media_player_ip || null,
      orientation: data.orientation,
      display_token: crypto.randomBytes(16).toString('hex'),
      last_heartbeat_at: new Date().toISOString(),
      is_online: true,
      reload_requested: false,
      created_at: new Date().toISOString(),
    };
    store.displayScreens.push(screen);
    broadcastRealtimeEvent({ table: 'screens', action: 'INSERT', data: screen });
    return screen;
  }

  static async recordScreenHeartbeat(token: string, ip?: string): Promise<boolean> {
    const screen = store.displayScreens.find((s) => s.display_token === token);
    if (!screen) return false;
    screen.last_heartbeat_at = new Date().toISOString();
    if (ip && !screen.media_player_ip) {
      screen.media_player_ip = ip;
    }
    const shouldReload = !!screen.reload_requested;
    if (shouldReload) screen.reload_requested = false;
    return shouldReload;
  }

  static async requestScreenReload(screenId: string): Promise<boolean> {
    const screen = store.displayScreens.find((s) => s.id === screenId);
    if (!screen) return false;
    screen.reload_requested = true;
    broadcastRealtimeEvent({ table: 'screens', action: 'RELOAD', id: screenId });
    return true;
  }

  static async regenerateDisplayToken(screenId: string): Promise<string | null> {
    const screen = store.displayScreens.find((s) => s.id === screenId);
    if (!screen) return null;
    screen.display_token = crypto.randomBytes(16).toString('hex');
    broadcastRealtimeEvent({ table: 'screens', action: 'UPDATE', data: screen });
    return screen.display_token;
  }

  // -------------------------
  // Admin Authentication & Security
  // -------------------------
  static async getAdminUser(): Promise<AdminUser | null> {
    return store.adminUser;
  }

  static async recordFailedLogin(ip: string): Promise<{ locked: boolean; minutesRemaining?: number }> {
    if (!store.adminUser) return { locked: false };
    store.adminUser.failed_attempts += 1;

    if (store.adminUser.failed_attempts >= 5) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      store.adminUser.locked_until = lockUntil.toISOString();
      await this.logAudit('ADMIN_LOCKED_OUT', 'system', ip, {
        reason: '5 consecutive failed password attempts',
        locked_until: lockUntil.toISOString(),
      });
      return { locked: true, minutesRemaining: 15 };
    }

    await this.logAudit('LOGIN_FAILED', 'admin', ip, {
      attempt: store.adminUser.failed_attempts,
    });

    return { locked: false };
  }

  static async resetFailedLogin(): Promise<void> {
    if (store.adminUser) {
      store.adminUser.failed_attempts = 0;
      store.adminUser.locked_until = null;
    }
  }

  static async createAdminSession(ip?: string, userAgent?: string): Promise<AdminSession> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days sliding
    const session: AdminSession = {
      id: crypto.randomUUID(),
      token,
      expires_at: expiresAt.toISOString(),
      last_activity_at: new Date().toISOString(),
      ip_address: ip,
      user_agent: userAgent,
      created_at: new Date().toISOString(),
    };
    store.sessions.push(session);
    return session;
  }

  static async verifyAdminSession(token: string): Promise<AdminSession | null> {
    const session = store.sessions.find((s) => s.token === token);
    if (!session) return null;

    if (new Date(session.expires_at) < new Date()) {
      // Expired
      this.deleteAdminSession(token);
      return null;
    }

    // Sliding renewal (update last_activity)
    session.last_activity_at = new Date().toISOString();
    return session;
  }

  static async deleteAdminSession(token: string): Promise<void> {
    const idx = store.sessions.findIndex((s) => s.token === token);
    if (idx !== -1) {
      store.sessions.splice(idx, 1);
    }
  }

  static async verifyAdminPin(pin: string): Promise<boolean> {
    if (!store.adminUser || !store.adminUser.pin_hash) return false;
    return bcrypt.compareSync(pin, store.adminUser.pin_hash);
  }

  static async updateAdminPassword(newPasswordHash: string): Promise<void> {
    if (store.adminUser) {
      store.adminUser.password_hash = newPasswordHash;
      store.adminUser.updated_at = new Date().toISOString();
    }
  }

  static async updateAdminPin(newPinHash: string): Promise<void> {
    if (store.adminUser) {
      store.adminUser.pin_hash = newPinHash;
      store.adminUser.updated_at = new Date().toISOString();
    }
  }

  // -------------------------
  // Audit Logs
  // -------------------------
  static async logAudit(
    action: string,
    actor: string,
    ip_address: string,
    details?: Record<string, any> | string
  ): Promise<AuditLog> {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      action,
      actor,
      ip_address,
      details: details || null,
      created_at: new Date().toISOString(),
    };
    store.auditLogs.unshift(log);
    // Retain up to 1000 logs in memory
    if (store.auditLogs.length > 1000) {
      store.auditLogs.pop();
    }
    return log;
  }

  static async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    return store.auditLogs.slice(0, limit);
  }

  // -------------------------
  // Settings
  // -------------------------
  static async getSettings(): Promise<AppSettings> {
    return { ...store.settings };
  }

  static async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    store.settings = { ...store.settings, ...updates };
    broadcastRealtimeEvent({ table: 'settings', action: 'UPDATE', data: store.settings });
    return { ...store.settings };
  }

  // -------------------------
  // Admin Dashboard Overview Stats
  // -------------------------
  static async getDashboardOverview() {
    const rooms = await this.getRooms();
    const allBookings = await this.getBookings();
    const blockedSlots = await this.getBlockedSlots();
    const settings = await this.getSettings();

    const todayStr = formatInDubai(new Date(), 'yyyy-MM-dd');
    const todayBookings = allBookings.filter((b) => {
      const bDay = formatInDubai(b.start_time, 'yyyy-MM-dd');
      return bDay === todayStr && b.status === 'confirmed';
    });

    let totalHoursBooked = 0;
    const roomBookingCounts: Record<string, number> = {};

    rooms.forEach((r) => {
      roomBookingCounts[r.id] = 0;
    });

    todayBookings.forEach((b) => {
      roomBookingCounts[b.room_id] = (roomBookingCounts[b.room_id] || 0) + 1;
      const s = parseISO(b.start_time).getTime();
      const e = parseISO(b.end_time).getTime();
      totalHoursBooked += (e - s) / (1000 * 60 * 60);
    });

    const activeRooms = rooms.filter((r) => r.is_active);
    const dayHours = settings.work_end_hour - settings.work_start_hour;
    const totalPossibleHours = activeRooms.length * dayHours;

    const utilization =
      totalPossibleHours > 0 ? Math.min(100, Math.round((totalHoursBooked / totalPossibleHours) * 100)) : 0;

    return {
      totalRooms: rooms.length,
      activeRooms: activeRooms.length,
      bookingsToday: todayBookings.length,
      hoursBookedToday: Math.round(totalHoursBooked * 10) / 10,
      utilizationPercentage: utilization,
      roomsOverview: rooms.map((r) => {
        const rBookings = allBookings.filter((b) => b.room_id === r.id);
        const rBlocked = blockedSlots.filter((b) => b.room_id === null || b.room_id === r.id);
        const status = computeRoomStatus(rBookings, rBlocked, settings);
        return {
          room: r,
          status,
          bookingsCountToday: roomBookingCounts[r.id] || 0,
        };
      }),
    };
  }
}
