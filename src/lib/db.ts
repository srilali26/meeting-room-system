import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Auto-load .env or .env.local if not already loaded by Next.js
function loadEnvFile() {
  if (process.env.DATABASE_URL) return;
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env.local'),
    path.resolve(__dirname, '../../.env'),
  ];
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const rawLine of content.split('\n')) {
          const trimmed = rawLine.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch (e) {
        // ignore read error
      }
    }
  }
}
loadEnvFile();
import {
  Room,
  Booking,
  BlockedSlot,
  AdminUser,
  AdminSession,
  DisplayScreen,
  AppSettings,
} from '@/types';
import {
  formatInDubai,
  createDubaiDateTime,
  getDubaiDayBoundaries,
  DEFAULT_SETTINGS,
  computeRoomStatus,
} from './timezone';
import { parseISO, isBefore, isAfter } from 'date-fns';

// ---------------------------------------------------------------------------
// Pure PostgreSQL Connection Pool (Zero in-memory fallback)
// ---------------------------------------------------------------------------
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !url.trim()) {
    throw new Error(
      'FATAL: DATABASE_URL is not defined in environment. PostgreSQL is required. The system will not run with an in-memory fallback.'
    );
  }
  return url.trim();
}

const globalForPg = globalThis as unknown as {
  __PG_POOL__?: Pool;
  __PG_LISTEN_CLIENT__?: PoolClient;
};

export function getPool(): Pool {
  if (!globalForPg.__PG_POOL__) {
    const connectionString = getDatabaseUrl();
    globalForPg.__PG_POOL__ = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    globalForPg.__PG_POOL__.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  }
  return globalForPg.__PG_POOL__;
}

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
      // dead client
    }
  });
}

// ---------------------------------------------------------------------------
// Database API Class (Direct PostgreSQL queries only)
// ---------------------------------------------------------------------------
export class Database {
  /**
   * Health Check: Verify PostgreSQL connection and return server metadata
   */
  static async testConnection(): Promise<{
    connected: boolean;
    database: string;
    serverTime: string;
    version: string;
  }> {
    const pool = getPool();
    try {
      const res = await pool.query(
        'SELECT NOW() as db_time, current_database() as db_name, version() as pg_version;'
      );
      const row = res.rows[0];
      return {
        connected: true,
        database: row.db_name,
        serverTime: row.db_time.toISOString(),
        version: row.pg_version,
      };
    } catch (err: any) {
      throw new Error(`Database Connection Error: Failed to query PostgreSQL. ${err.message}`);
    }
  }

  // -------------------------
  // Rooms
  // -------------------------
  static async getRooms(): Promise<Room[]> {
    const pool = getPool();
    const res = await pool.query(
      'SELECT id, name, location, capacity, amenities, is_active, created_at FROM rooms ORDER BY name;'
    );
    return res.rows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at).toISOString(),
    }));
  }

  static async getRoomById(id: string): Promise<Room | null> {
    const pool = getPool();
    const res = await pool.query(
      'SELECT id, name, location, capacity, amenities, is_active, created_at FROM rooms WHERE id = $1;',
      [id]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      created_at: new Date(r.created_at).toISOString(),
    };
  }

  static async createRoom(data: Omit<Room, 'id' | 'created_at'>): Promise<Room> {
    const pool = getPool();
    const res = await pool.query(
      `INSERT INTO rooms (name, location, capacity, amenities, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, location, capacity, amenities, is_active, created_at;`,
      [data.name, data.location, data.capacity, data.amenities || [], data.is_active ?? true]
    );
    const room: Room = {
      ...res.rows[0],
      created_at: new Date(res.rows[0].created_at).toISOString(),
    };
    broadcastRealtimeEvent({ table: 'rooms', action: 'INSERT', data: room });
    return room;
  }

  static async updateRoom(id: string, updates: Partial<Room>): Promise<Room | null> {
    const pool = getPool();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.location !== undefined) {
      fields.push(`location = $${idx++}`);
      values.push(updates.location);
    }
    if (updates.capacity !== undefined) {
      fields.push(`capacity = $${idx++}`);
      values.push(updates.capacity);
    }
    if (updates.amenities !== undefined) {
      fields.push(`amenities = $${idx++}`);
      values.push(updates.amenities);
    }
    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(updates.is_active);
    }

    if (fields.length === 0) return await this.getRoomById(id);

    values.push(id);
    const sql = `UPDATE rooms SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, location, capacity, amenities, is_active, created_at;`;
    const res = await pool.query(sql, values);
    if (res.rows.length === 0) return null;

    const updated: Room = {
      ...res.rows[0],
      created_at: new Date(res.rows[0].created_at).toISOString(),
    };
    broadcastRealtimeEvent({ table: 'rooms', action: 'UPDATE', data: updated });
    return updated;
  }

  static async suggestNextRoomName(): Promise<string> {
    const pool = getPool();
    const res = await pool.query('SELECT name FROM rooms;');
    const numbers = res.rows
      .map((r: { name: string }) => {
        const match = r.name.match(/Meeting Room (\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n: number) => n > 0);
    const max = numbers.length > 0 ? Math.max(...numbers) : 5;
    return `Meeting Room ${max + 1}`;
  }

  // -------------------------
  // Bookings
  // -------------------------
  static async getBookings(roomId?: string, dateStr?: string): Promise<Booking[]> {
    const pool = getPool();
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (roomId) {
      conditions.push(`room_id = $${idx++}`);
      params.push(roomId);
    }

    if (dateStr) {
      const { dayStart, dayEnd } = getDubaiDayBoundaries(dateStr);
      conditions.push(`start_time < $${idx++} AND end_time > $${idx++}`);
      params.push(dayEnd.toISOString(), dayStart.toISOString());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT id, room_id, title, organizer_name, organizer_email, start_time, end_time, notes, cancel_token, status, created_at
                 FROM bookings ${where} ORDER BY start_time ASC;`;

    const res = await pool.query(sql, params);
    return res.rows.map((b) => ({
      ...b,
      start_time: new Date(b.start_time).toISOString(),
      end_time: new Date(b.end_time).toISOString(),
      created_at: new Date(b.created_at).toISOString(),
    }));
  }

  static async getBookingById(id: string): Promise<Booking | null> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT id, room_id, title, organizer_name, organizer_email, start_time, end_time, notes, cancel_token, status, created_at
       FROM bookings WHERE id = $1;`,
      [id]
    );
    if (res.rows.length === 0) return null;
    const b = res.rows[0];
    return {
      ...b,
      start_time: new Date(b.start_time).toISOString(),
      end_time: new Date(b.end_time).toISOString(),
      created_at: new Date(b.created_at).toISOString(),
    };
  }

  static async getBookingByCancelToken(token: string): Promise<Booking | null> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT id, room_id, title, organizer_name, organizer_email, start_time, end_time, notes, cancel_token, status, created_at
       FROM bookings WHERE cancel_token = $1;`,
      [token]
    );
    if (res.rows.length === 0) return null;
    const b = res.rows[0];
    return {
      ...b,
      start_time: new Date(b.start_time).toISOString(),
      end_time: new Date(b.end_time).toISOString(),
      created_at: new Date(b.created_at).toISOString(),
    };
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
    const pool = getPool();
    const newStart = parseISO(dto.start_time);
    const newEnd = parseISO(dto.end_time);

    // 1. Verify room is active
    const room = await this.getRoomById(dto.room_id);
    if (!room || !room.is_active) {
      throw new Error('This meeting room is inactive and cannot be booked.');
    }

    // 2. Check blocked slot conflict
    const blockedRes = await pool.query(
      `SELECT * FROM blocked_slots
       WHERE (room_id IS NULL OR room_id = $1)
         AND start_time < $3 AND end_time > $2;`,
      [dto.room_id, dto.start_time, dto.end_time]
    );

    const hasBlock = blockedRes.rows.some((block: any) => {
      if (block.recurring_rule === 'FRIDAY_12_14') {
        const day = formatInDubai(newStart, 'EEEE');
        const h = parseInt(formatInDubai(newStart, 'H'), 10);
        if (day === 'Friday' && h >= 12 && h < 14) return true;
      }
      return true;
    });

    if (hasBlock) {
      const err = new Error('This time slot is blocked and unavailable for booking.');
      (err as any).code = 'SLOT_BLOCKED';
      throw err;
    }

    // 3. Insert into PostgreSQL (enforcing exclusion constraint no_overlapping_confirmed_bookings)
    const cancelToken = crypto.randomBytes(16).toString('hex');
    try {
      const res = await pool.query(
        `INSERT INTO bookings (room_id, title, organizer_name, organizer_email, start_time, end_time, notes, cancel_token, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed')
         RETURNING id, room_id, title, organizer_name, organizer_email, start_time, end_time, notes, cancel_token, status, created_at;`,
        [
          dto.room_id,
          dto.title,
          dto.organizer_name,
          dto.organizer_email,
          dto.start_time,
          dto.end_time,
          dto.notes || null,
          cancelToken,
        ]
      );

      const booking: Booking = {
        ...res.rows[0],
        start_time: new Date(res.rows[0].start_time).toISOString(),
        end_time: new Date(res.rows[0].end_time).toISOString(),
        created_at: new Date(res.rows[0].created_at).toISOString(),
      };

      broadcastRealtimeEvent({ table: 'bookings', action: 'INSERT', data: booking });
      return booking;
    } catch (err: any) {
      // PostgreSQL 23P01 is exclusion_violation
      if (err.code === '23P01' || err.message?.includes('no_overlapping_confirmed_bookings')) {
        const error = new Error('This slot was just taken, please pick another.');
        (error as any).code = '23P01';
        throw error;
      }
      throw err;
    }
  }

  static async updateBooking(id: string, updates: Partial<Booking>): Promise<Booking | null> {
    const pool = getPool();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(updates.title);
    }
    if (updates.organizer_name !== undefined) {
      fields.push(`organizer_name = $${idx++}`);
      values.push(updates.organizer_name);
    }
    if (updates.organizer_email !== undefined) {
      fields.push(`organizer_email = $${idx++}`);
      values.push(updates.organizer_email);
    }
    if (updates.start_time !== undefined) {
      fields.push(`start_time = $${idx++}`);
      values.push(updates.start_time);
    }
    if (updates.end_time !== undefined) {
      fields.push(`end_time = $${idx++}`);
      values.push(updates.end_time);
    }
    if (updates.notes !== undefined) {
      fields.push(`notes = $${idx++}`);
      values.push(updates.notes);
    }
    if (updates.room_id !== undefined) {
      fields.push(`room_id = $${idx++}`);
      values.push(updates.room_id);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }

    if (fields.length === 0) return await this.getBookingById(id);

    values.push(id);
    const sql = `UPDATE bookings SET ${fields.join(', ')} WHERE id = $${idx}
                 RETURNING id, room_id, title, organizer_name, organizer_email, start_time, end_time, notes, cancel_token, status, created_at;`;

    try {
      const res = await pool.query(sql, values);
      if (res.rows.length === 0) return null;

      const booking: Booking = {
        ...res.rows[0],
        start_time: new Date(res.rows[0].start_time).toISOString(),
        end_time: new Date(res.rows[0].end_time).toISOString(),
        created_at: new Date(res.rows[0].created_at).toISOString(),
      };
      broadcastRealtimeEvent({ table: 'bookings', action: 'UPDATE', data: booking });
      return booking;
    } catch (err: any) {
      if (err.code === '23P01' || err.message?.includes('no_overlapping_confirmed_bookings')) {
        const error = new Error('The updated time slot overlaps with an existing booking.');
        (error as any).code = '23P01';
        throw error;
      }
      throw err;
    }
  }

  static async cancelBookingByToken(token: string): Promise<Booking> {
    const pool = getPool();
    const res = await pool.query(
      `UPDATE bookings SET status = 'cancelled' WHERE cancel_token = $1
       RETURNING id, room_id, title, organizer_name, organizer_email, start_time, end_time, notes, cancel_token, status, created_at;`,
      [token]
    );
    if (res.rows.length === 0) {
      throw new Error('Invalid cancellation token or booking not found.');
    }
    const booking: Booking = {
      ...res.rows[0],
      start_time: new Date(res.rows[0].start_time).toISOString(),
      end_time: new Date(res.rows[0].end_time).toISOString(),
      created_at: new Date(res.rows[0].created_at).toISOString(),
    };
    broadcastRealtimeEvent({ table: 'bookings', action: 'UPDATE', data: booking });
    return booking;
  }

  static async adminCancelBooking(id: string): Promise<Booking> {
    const pool = getPool();
    const res = await pool.query(
      `UPDATE bookings SET status = 'cancelled' WHERE id = $1
       RETURNING id, room_id, title, organizer_name, organizer_email, start_time, end_time, notes, cancel_token, status, created_at;`,
      [id]
    );
    if (res.rows.length === 0) {
      throw new Error('Booking not found.');
    }
    const booking: Booking = {
      ...res.rows[0],
      start_time: new Date(res.rows[0].start_time).toISOString(),
      end_time: new Date(res.rows[0].end_time).toISOString(),
      created_at: new Date(res.rows[0].created_at).toISOString(),
    };
    broadcastRealtimeEvent({ table: 'bookings', action: 'UPDATE', data: booking });
    return booking;
  }

  // -------------------------
  // Blocked Slots
  // -------------------------
  static async getBlockedSlots(roomId?: string, dateStr?: string): Promise<BlockedSlot[]> {
    const pool = getPool();
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (roomId) {
      conditions.push(`(room_id IS NULL OR room_id = $${idx++})`);
      params.push(roomId);
    }

    if (dateStr) {
      const { dayStart, dayEnd } = getDubaiDayBoundaries(dateStr);
      conditions.push(`(recurring_rule IS NOT NULL OR (start_time < $${idx++} AND end_time > $${idx++}))`);
      params.push(dayEnd.toISOString(), dayStart.toISOString());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM blocked_slots ${where} ORDER BY start_time ASC;`;
    const res = await pool.query(sql, params);
    return res.rows.map((b) => ({
      ...b,
      start_time: new Date(b.start_time).toISOString(),
      end_time: new Date(b.end_time).toISOString(),
      created_at: new Date(b.created_at).toISOString(),
    }));
  }

  static async createBlockedSlot(dto: {
    room_id?: string | null;
    title: string;
    reason?: string | null;
    start_time: string;
    end_time: string;
    recurring_rule?: string | null;
  }): Promise<{ blockedSlot: BlockedSlot; affectedBookingsCount: number }> {
    const pool = getPool();

    // Check affected confirmed bookings
    const countRes = await pool.query(
      `SELECT count(*) FROM bookings
       WHERE ($1::uuid IS NULL OR room_id = $1::uuid)
         AND status = 'confirmed'
         AND start_time < $3 AND end_time > $2;`,
      [dto.room_id || null, dto.start_time, dto.end_time]
    );
    const affectedCount = parseInt(countRes.rows[0].count, 10);

    const res = await pool.query(
      `INSERT INTO blocked_slots (room_id, title, reason, start_time, end_time, recurring_rule, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'admin')
       RETURNING id, room_id, title, reason, start_time, end_time, recurring_rule, created_by, created_at;`,
      [
        dto.room_id || null,
        dto.title,
        dto.reason || null,
        dto.start_time,
        dto.end_time,
        dto.recurring_rule || null,
      ]
    );

    const blocked: BlockedSlot = {
      ...res.rows[0],
      start_time: new Date(res.rows[0].start_time).toISOString(),
      end_time: new Date(res.rows[0].end_time).toISOString(),
      created_at: new Date(res.rows[0].created_at).toISOString(),
    };

    broadcastRealtimeEvent({ table: 'blocked_slots', action: 'INSERT', data: blocked });
    return { blockedSlot: blocked, affectedBookingsCount: affectedCount };
  }

  static async deleteBlockedSlot(id: string): Promise<boolean> {
    const pool = getPool();
    const res = await pool.query('DELETE FROM blocked_slots WHERE id = $1 RETURNING id;', [id]);
    if (res.rows.length === 0) return false;
    broadcastRealtimeEvent({ table: 'blocked_slots', action: 'DELETE', id });
    return true;
  }

  // -------------------------
  // Display Screens
  // -------------------------
  static async getDisplayScreens(): Promise<DisplayScreen[]> {
    const pool = getPool();
    const res = await pool.query('SELECT * FROM display_screens ORDER BY name;');
    const now = Date.now();
    return res.rows.map((s) => {
      const last = s.last_heartbeat_at ? new Date(s.last_heartbeat_at).getTime() : 0;
      const isOnline = now - last < 90000;
      return {
        ...s,
        is_online: isOnline,
        last_heartbeat_at: s.last_heartbeat_at ? new Date(s.last_heartbeat_at).toISOString() : null,
        created_at: new Date(s.created_at).toISOString(),
      };
    });
  }

  static async getDisplayScreenByToken(token: string): Promise<DisplayScreen | null> {
    const pool = getPool();
    const res = await pool.query('SELECT * FROM display_screens WHERE display_token = $1;', [token]);
    if (res.rows.length === 0) return null;
    const s = res.rows[0];
    return {
      ...s,
      last_heartbeat_at: s.last_heartbeat_at ? new Date(s.last_heartbeat_at).toISOString() : null,
      created_at: new Date(s.created_at).toISOString(),
    };
  }

  static async registerDisplayScreen(data: {
    name: string;
    room_id: string;
    media_player_ip?: string | null;
    orientation: 'landscape' | 'portrait';
  }): Promise<DisplayScreen> {
    const pool = getPool();
    const token = crypto.randomBytes(16).toString('hex');
    const res = await pool.query(
      `INSERT INTO display_screens (name, room_id, media_player_ip, orientation, display_token, last_heartbeat_at, reload_requested)
       VALUES ($1, $2, $3, $4, $5, NOW(), FALSE)
       RETURNING *;`,
      [data.name, data.room_id, data.media_player_ip || null, data.orientation, token]
    );

    const screen: DisplayScreen = {
      ...res.rows[0],
      is_online: true,
      last_heartbeat_at: new Date().toISOString(),
      created_at: new Date(res.rows[0].created_at).toISOString(),
    };
    broadcastRealtimeEvent({ table: 'screens', action: 'INSERT', data: screen });
    return screen;
  }

  static async recordScreenHeartbeat(token: string, ip?: string): Promise<boolean> {
    const pool = getPool();
    const res = await pool.query(
      `UPDATE display_screens
       SET last_heartbeat_at = NOW(),
           media_player_ip = COALESCE(media_player_ip, $2)
       WHERE display_token = $1
       RETURNING reload_requested;`,
      [token, ip || null]
    );
    if (res.rows.length === 0) return false;
    const reload = res.rows[0].reload_requested;
    if (reload) {
      await pool.query('UPDATE display_screens SET reload_requested = FALSE WHERE display_token = $1;', [token]);
    }
    return reload;
  }

  static async requestScreenReload(screenId: string): Promise<boolean> {
    const pool = getPool();
    const res = await pool.query(
      'UPDATE display_screens SET reload_requested = TRUE WHERE id = $1 RETURNING id;',
      [screenId]
    );
    if (res.rows.length === 0) return false;
    broadcastRealtimeEvent({ table: 'screens', action: 'RELOAD', id: screenId });
    return true;
  }

  static async regenerateDisplayToken(screenId: string): Promise<string | null> {
    const pool = getPool();
    const newToken = crypto.randomBytes(16).toString('hex');
    const res = await pool.query(
      'UPDATE display_screens SET display_token = $1 WHERE id = $2 RETURNING display_token;',
      [newToken, screenId]
    );
    if (res.rows.length === 0) return null;
    return newToken;
  }

  // -------------------------
  // Admin User & Authentication (Table: admin_user)
  // -------------------------
  static async getAdminUser(username = 'admin'): Promise<AdminUser | null> {
    const pool = getPool();
    const res = await pool.query(
      'SELECT id, username, password_hash, pin_hash, failed_attempts, locked_until, created_at, updated_at FROM admin_user WHERE username = $1 LIMIT 1;',
      [username]
    );
    if (res.rows.length === 0) return null;
    const u = res.rows[0];
    return {
      ...u,
      locked_until: u.locked_until ? new Date(u.locked_until).toISOString() : null,
      created_at: new Date(u.created_at).toISOString(),
      updated_at: new Date(u.updated_at).toISOString(),
    };
  }

  static async createOrUpdateAdminUser(
    username: string,
    passwordHash: string,
    pinHash: string
  ): Promise<AdminUser> {
    const pool = getPool();
    const res = await pool.query(
      `INSERT INTO admin_user (username, password_hash, pin_hash, failed_attempts, locked_until)
       VALUES ($1, $2, $3, 0, NULL)
       ON CONFLICT (username) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         pin_hash = EXCLUDED.pin_hash,
         failed_attempts = 0,
         locked_until = NULL,
         updated_at = NOW()
       RETURNING id, username, password_hash, pin_hash, failed_attempts, locked_until, created_at, updated_at;`,
      [username, passwordHash, pinHash]
    );
    const u = res.rows[0];
    return {
      ...u,
      locked_until: null,
      created_at: new Date(u.created_at).toISOString(),
      updated_at: new Date(u.updated_at).toISOString(),
    };
  }

  static async recordFailedLogin(
    ip: string,
    username = 'admin'
  ): Promise<{ locked: boolean; minutesRemaining?: number }> {
    const pool = getPool();
    const res = await pool.query(
      `UPDATE admin_user
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE locked_until END,
           updated_at = NOW()
       WHERE username = $1
       RETURNING failed_attempts, locked_until;`,
      [username]
    );

    if (res.rows.length === 0) return { locked: false };
    const { failed_attempts, locked_until } = res.rows[0];

    if (failed_attempts >= 5 && locked_until) {
      await this.logAudit('ADMIN_LOCKED_OUT', username, ip, {
        reason: '5 consecutive failed password attempts',
        locked_until: new Date(locked_until).toISOString(),
      });
      return { locked: true, minutesRemaining: 15 };
    }

    await this.logAudit('LOGIN_FAILED', username, ip, { attempt: failed_attempts });
    return { locked: false };
  }

  static async resetFailedLogin(username = 'admin'): Promise<void> {
    const pool = getPool();
    await pool.query(
      'UPDATE admin_user SET failed_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE username = $1;',
      [username]
    );
  }

  static async updateAdminPassword(newPasswordHash: string, username = 'admin'): Promise<void> {
    const pool = getPool();
    await pool.query(
      'UPDATE admin_user SET password_hash = $1, updated_at = NOW() WHERE username = $2;',
      [newPasswordHash, username]
    );
  }

  static async updateAdminPin(newPinHash: string, username = 'admin'): Promise<void> {
    const pool = getPool();
    await pool.query(
      'UPDATE admin_user SET pin_hash = $1, updated_at = NOW() WHERE username = $2;',
      [newPinHash, username]
    );
  }

  static async verifyAdminPin(pin: string, username = 'admin'): Promise<boolean> {
    const user = await this.getAdminUser(username);
    if (!user || !user.pin_hash) return false;
    return bcrypt.compareSync(pin, user.pin_hash);
  }

  // -------------------------
  // Admin Sessions (Table: admin_sessions)
  // -------------------------
  static async createAdminSession(ip?: string, userAgent?: string): Promise<AdminSession> {
    const pool = getPool();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days sliding

    const res = await pool.query(
      `INSERT INTO admin_sessions (token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4)
       RETURNING id, token, expires_at, last_activity_at, ip_address, user_agent, created_at;`,
      [token, expiresAt.toISOString(), ip || null, userAgent || null]
    );

    const s = res.rows[0];
    return {
      ...s,
      expires_at: new Date(s.expires_at).toISOString(),
      last_activity_at: new Date(s.last_activity_at).toISOString(),
      created_at: new Date(s.created_at).toISOString(),
    };
  }

  static async verifyAdminSession(token: string): Promise<AdminSession | null> {
    const pool = getPool();
    const res = await pool.query(
      `UPDATE admin_sessions
       SET last_activity_at = NOW()
       WHERE token = $1 AND expires_at > NOW()
       RETURNING id, token, expires_at, last_activity_at, ip_address, user_agent, created_at;`,
      [token]
    );
    if (res.rows.length === 0) return null;
    const s = res.rows[0];
    return {
      ...s,
      expires_at: new Date(s.expires_at).toISOString(),
      last_activity_at: new Date(s.last_activity_at).toISOString(),
      created_at: new Date(s.created_at).toISOString(),
    };
  }

  static async deleteAdminSession(token: string): Promise<void> {
    const pool = getPool();
    await pool.query('DELETE FROM admin_sessions WHERE token = $1;', [token]);
  }

  // -------------------------
  // Audit Logs (Disabled per Change 2)
  // -------------------------
  static async logAudit(
    _action?: string,
    _actor?: string,
    _ip_address?: string,
    _details?: Record<string, any> | string
  ): Promise<void> {
    // Audit logging safely removed
  }

  // -------------------------
  // App Settings (Table: app_settings)
  // -------------------------
  static async getSettings(): Promise<AppSettings> {
    const pool = getPool();
    const res = await pool.query(
      'SELECT work_start_hour, work_end_hour, slot_duration_minutes, max_booking_duration_hours, max_advance_booking_days, privacy_mode, inactivity_lock_minutes FROM app_settings WHERE id = 1;'
    );
    if (res.rows.length === 0) {
      return { ...DEFAULT_SETTINGS };
    }
    return res.rows[0];
  }

  static async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const pool = getPool();
    const fields: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let idx = 1;

    if (updates.work_start_hour !== undefined) {
      fields.push(`work_start_hour = $${idx++}`);
      values.push(updates.work_start_hour);
    }
    if (updates.work_end_hour !== undefined) {
      fields.push(`work_end_hour = $${idx++}`);
      values.push(updates.work_end_hour);
    }
    if (updates.slot_duration_minutes !== undefined) {
      fields.push(`slot_duration_minutes = $${idx++}`);
      values.push(updates.slot_duration_minutes);
    }
    if (updates.max_booking_duration_hours !== undefined) {
      fields.push(`max_booking_duration_hours = $${idx++}`);
      values.push(updates.max_booking_duration_hours);
    }
    if (updates.max_advance_booking_days !== undefined) {
      fields.push(`max_advance_booking_days = $${idx++}`);
      values.push(updates.max_advance_booking_days);
    }
    if (updates.privacy_mode !== undefined) {
      fields.push(`privacy_mode = $${idx++}`);
      values.push(updates.privacy_mode);
    }
    if (updates.inactivity_lock_minutes !== undefined) {
      fields.push(`inactivity_lock_minutes = $${idx++}`);
      values.push(updates.inactivity_lock_minutes);
    }

    const sql = `UPDATE app_settings SET ${fields.join(', ')} WHERE id = 1
                 RETURNING work_start_hour, work_end_hour, slot_duration_minutes, max_booking_duration_hours, max_advance_booking_days, privacy_mode, inactivity_lock_minutes;`;
    const res = await pool.query(sql, values);
    const updated = res.rows[0];
    broadcastRealtimeEvent({ table: 'settings', action: 'UPDATE', data: updated });
    return updated;
  }

  // -------------------------
  // Dashboard Overview
  // -------------------------
  static async getDashboardOverview(dateStr?: string) {
    const rooms = await this.getRooms();
    const allBookings = await this.getBookings();
    const blockedSlots = await this.getBlockedSlots();
    const settings = await this.getSettings();

    const targetDateStr = dateStr || formatInDubai(new Date(), 'yyyy-MM-dd');
    const { dayStart, dayEnd } = getDubaiDayBoundaries(targetDateStr);

    const todayBookings = allBookings.filter((b) => {
      if (b.status !== 'confirmed') return false;
      const s = parseISO(b.start_time);
      const e = parseISO(b.end_time);
      return isBefore(s, dayEnd) && isAfter(e, dayStart);
    });

    const workStart = createDubaiDateTime(targetDateStr, settings.work_start_hour, 0);
    const workEnd = createDubaiDateTime(targetDateStr, settings.work_end_hour, 0);

    let totalHoursBooked = 0;
    const roomBookingCounts: Record<string, number> = {};

    rooms.forEach((r) => {
      roomBookingCounts[r.id] = 0;
    });

    todayBookings.forEach((b) => {
      roomBookingCounts[b.room_id] = (roomBookingCounts[b.room_id] || 0) + 1;
      const s = Math.max(parseISO(b.start_time).getTime(), workStart.getTime());
      const e = Math.min(parseISO(b.end_time).getTime(), workEnd.getTime());
      if (e > s) {
        totalHoursBooked += (e - s) / (1000 * 60 * 60);
      }
    });

    const activeRooms = rooms.filter((r) => r.is_active);
    const dayHours = Math.max(1, settings.work_end_hour - settings.work_start_hour);
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
