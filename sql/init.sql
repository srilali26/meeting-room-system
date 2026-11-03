-- PostgreSQL Migration for Meeting Room Booking System
-- Designed for Self-Hosted Windows Server deployment

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  amenities TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings Table with Database Exclusion Constraint
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  organizer_name TEXT NOT NULL,
  organizer_email TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  notes TEXT,
  cancel_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_duration CHECK (
    end_time > start_time AND
    end_time <= start_time + INTERVAL '12 hours'
  ),

  -- Database-Level Overlap Exclusion (PostgreSQL btree_gist)
  CONSTRAINT no_overlapping_confirmed_bookings EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status = 'confirmed')
);

-- Blocked Slots Table
CREATE TABLE IF NOT EXISTS blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE, -- NULL means blocked across ALL rooms
  title TEXT NOT NULL,
  reason TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  recurring_rule TEXT, -- e.g. "FRIDAY_12_14"
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single Admin User Account Table
CREATE TABLE IF NOT EXISTS admin_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE DEFAULT 'admin',
  password_hash TEXT NOT NULL,
  pin_hash TEXT,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin Sessions Table
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Display Screens Table
CREATE TABLE IF NOT EXISTS display_screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  media_player_ip TEXT,
  orientation TEXT NOT NULL DEFAULT 'landscape' CHECK (orientation IN ('landscape', 'portrait')),
  display_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  last_heartbeat_at TIMESTAMPTZ,
  reload_requested BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Global Application Settings
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  work_start_hour INTEGER NOT NULL DEFAULT 8,
  work_end_hour INTEGER NOT NULL DEFAULT 20,
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  max_booking_duration_hours INTEGER NOT NULL DEFAULT 4,
  max_advance_booking_days INTEGER NOT NULL DEFAULT 30,
  privacy_mode BOOLEAN NOT NULL DEFAULT false,
  inactivity_lock_minutes INTEGER NOT NULL DEFAULT 15,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Initialize default app settings
INSERT INTO app_settings (id, work_start_hour, work_end_hour, slot_duration_minutes, max_booking_duration_hours, max_advance_booking_days, privacy_mode, inactivity_lock_minutes)
VALUES (1, 8, 20, 30, 4, 30, false, 15)
ON CONFLICT (id) DO NOTHING;

-- Seed the exactly 5 Default Meeting Rooms
INSERT INTO rooms (id, name, location, capacity, amenities, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Meeting Room 1', 'Floor 1, Main Wing', 16, ARRAY['4K Dual Display', 'Video Conferencing Kit', 'Conference Phone', 'Digital Whiteboard', 'High-speed Wi-Fi'], true),
  ('22222222-2222-2222-2222-222222222222', 'Meeting Room 2', 'Floor 2, East Wing', 8, ARRAY['Touchscreen Smart Board', 'Video Conferencing', 'Modular Desks', 'Wireless Presentation'], true),
  ('33333333-3333-3333-3333-333333333333', 'Meeting Room 3', 'Floor 2, Quiet Zone', 4, ARRAY['Ultra-wide Monitor', 'Acoustic Soundproofing', 'Ergonomic Seating', 'High-speed Wi-Fi'], true),
  ('44444444-4444-4444-4444-444444444444', 'Meeting Room 4', 'Floor 3, West Wing', 10, ARRAY['4K Display', 'Video Bar', 'Whiteboard', 'Conference Table'], true),
  ('55555555-5555-5555-5555-555555555555', 'Meeting Room 5', 'Floor 3, Collaboration Hub', 6, ARRAY['Touchscreen TV', 'Modular Seating', 'Wireless Screen Mirroring'], true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, location = EXCLUDED.location;

-- Seed Display Screens for each of the 5 rooms
INSERT INTO display_screens (id, name, room_id, orientation, display_token)
VALUES
  ('d1111111-1111-1111-1111-111111111111', 'Meeting Room 1 Tablet', '11111111-1111-1111-1111-111111111111', 'landscape', 'token-screen-room-1'),
  ('d2222222-2222-2222-2222-222222222222', 'Meeting Room 2 Tablet', '22222222-2222-2222-2222-222222222222', 'landscape', 'token-screen-room-2'),
  ('d3333333-3333-3333-3333-333333333333', 'Meeting Room 3 Tablet', '33333333-3333-3333-3333-333333333333', 'portrait',  'token-screen-room-3'),
  ('d4444444-4444-4444-4444-444444444444', 'Meeting Room 4 Tablet', '44444444-4444-4444-4444-444444444444', 'landscape', 'token-screen-room-4'),
  ('d5555555-5555-5555-5555-555555555555', 'Meeting Room 5 Tablet', '55555555-5555-5555-5555-555555555555', 'landscape', 'token-screen-room-5')
ON CONFLICT (id) DO NOTHING;

-- Seed a sample recurring Friday block (e.g. 12:00 - 14:00 Friday Prayer across all rooms)
INSERT INTO blocked_slots (id, room_id, title, reason, start_time, end_time, recurring_rule)
VALUES
  ('bbbb0000-0000-0000-0000-000000000001', NULL, 'Friday Prayer & Building Maintenance', 'Regular weekly maintenance and Friday prayer break across all meeting rooms', now(), now() + interval '1 year', 'FRIDAY_12_14')
ON CONFLICT (id) DO NOTHING;

-- PostgreSQL Realtime Notification Function
CREATE OR REPLACE FUNCTION notify_meeting_room_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  IF TG_OP = 'DELETE' THEN
    payload := json_build_object('table', TG_TABLE_NAME, 'action', TG_OP, 'id', OLD.id);
  ELSE
    payload := json_build_object('table', TG_TABLE_NAME, 'action', TG_OP, 'data', row_to_json(NEW));
  END IF;

  PERFORM pg_notify('meeting_room_events', payload::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Notification Triggers
DROP TRIGGER IF EXISTS trigger_bookings_notify ON bookings;
CREATE TRIGGER trigger_bookings_notify
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW EXECUTE FUNCTION notify_meeting_room_change();

DROP TRIGGER IF EXISTS trigger_blocked_slots_notify ON blocked_slots;
CREATE TRIGGER trigger_blocked_slots_notify
AFTER INSERT OR UPDATE OR DELETE ON blocked_slots
FOR EACH ROW EXECUTE FUNCTION notify_meeting_room_change();

DROP TRIGGER IF EXISTS trigger_rooms_notify ON rooms;
CREATE TRIGGER trigger_rooms_notify
AFTER INSERT OR UPDATE OR DELETE ON rooms
FOR EACH ROW EXECUTE FUNCTION notify_meeting_room_change();
