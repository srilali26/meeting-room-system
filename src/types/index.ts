export interface Room {
  id: string;
  name: string;
  location: string;
  capacity: number;
  amenities: string[];
  is_active: boolean;
  created_at: string;
}

export type BookingStatus = 'confirmed' | 'cancelled';

export interface Booking {
  id: string;
  room_id: string;
  title: string;
  organizer_name: string;
  organizer_email: string;
  start_time: string; // ISO 8601 UTC
  end_time: string;   // ISO 8601 UTC
  notes?: string | null;
  cancel_token: string;
  status: BookingStatus;
  created_at: string;
}

export interface BlockedSlot {
  id: string;
  room_id: string | null; // null represents all rooms
  title: string;
  reason?: string | null;
  start_time: string;     // ISO 8601 UTC
  end_time: string;       // ISO 8601 UTC
  recurring_rule?: string | null; // e.g. "FRIDAY_12_14" or null
  created_by?: string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  username: string;
  password_hash: string;
  pin_hash?: string | null;
  failed_attempts: number;
  locked_until?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminSession {
  id: string;
  token: string;
  expires_at: string;
  last_activity_at: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface DisplayScreen {
  id: string;
  name: string;
  room_id: string;
  media_player_ip?: string | null;
  orientation: 'landscape' | 'portrait';
  display_token: string;
  last_heartbeat_at?: string | null;
  is_online?: boolean;
  reload_requested?: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actor: string;
  ip_address: string;
  details?: Record<string, any> | string | null;
  created_at: string;
}

export interface AppSettings {
  work_start_hour: number;        // default 8 (08:00)
  work_end_hour: number;          // default 20 (20:00)
  slot_duration_minutes: number;  // default 30
  max_booking_duration_hours: number; // default 4
  max_advance_booking_days: number;   // default 30
  privacy_mode: boolean;          // if true, shows "Booked" instead of title
  inactivity_lock_minutes: number;// default 15
}

export type SlotState = 'free' | 'booked' | 'blocked' | 'past';

export interface TimelineSlot {
  slotIndex: number;
  startTime: Date;
  endTime: Date;
  startLabel: string; // "08:00"
  endLabel: string;   // "08:30"
  state: SlotState;
  booking?: Booking;
  blockedSlot?: BlockedSlot;
}

export interface RoomStatusInfo {
  state: 'available' | 'occupied' | 'blocked';
  statusText: string;
  bannerText: string;
  nextMeetingSummary?: string | null;
  currentBooking?: Booking | null;
  currentBlockedSlot?: BlockedSlot | null;
  nextBooking?: Booking | null;
  occupiedUntil?: string | null;
  freeUntil?: string | null;
  freeFrom?: string | null;
}
