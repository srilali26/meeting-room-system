import { formatInTimeZone, toDate } from 'date-fns-tz';
import { isAfter, isBefore, isEqual, parseISO } from 'date-fns';
import { Booking, BlockedSlot, RoomStatusInfo, TimelineSlot, AppSettings, SlotState } from '@/types';

export const DUBAI_TIMEZONE = 'Asia/Dubai';
export const DUBAI_UTC_OFFSET_HOURS = 4;

export const DEFAULT_SETTINGS: AppSettings = {
  work_start_hour: 8,
  work_end_hour: 20,
  slot_duration_minutes: 30,
  max_booking_duration_hours: 4,
  max_advance_booking_days: 30,
  privacy_mode: false,
  inactivity_lock_minutes: 15,
};

export function formatInDubai(date: Date | string, formatPattern: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(d, DUBAI_TIMEZONE, formatPattern);
}

export function getNow(): Date {
  return new Date();
}

/**
 * Returns UTC Date for given dateStr (YYYY-MM-DD) and Dubai hour/minute
 */
export function createDubaiDateTime(dateStr: string, hour: number, minute: number): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  // Dubai is permanently UTC+4
  return new Date(Date.UTC(year, month, day, hour - DUBAI_UTC_OFFSET_HOURS, minute, 0, 0));
}

/**
 * Returns the exact UTC start and end boundaries for a full day (00:00:00.000 to 23:59:59.999) in Asia/Dubai (UTC+4)
 */
export function getDubaiDayBoundaries(dateStr: string): { dayStart: Date; dayEnd: Date } {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const dayStart = new Date(Date.UTC(year, month, day, 0 - DUBAI_UTC_OFFSET_HOURS, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(year, month, day, 23 - DUBAI_UTC_OFFSET_HOURS, 59, 59, 999));
  return { dayStart, dayEnd };
}

/**
 * Checks if a time range [startTimeIso, endTimeIso] overlaps the given Dubai day [00:00 to 23:59]
 * Condition: start_time < dayEnd AND end_time > dayStart
 */
export function isOverlappingDubaiDay(
  startTimeIso: string | Date,
  endTimeIso: string | Date,
  dateStr: string
): boolean {
  const { dayStart, dayEnd } = getDubaiDayBoundaries(dateStr);
  const s = typeof startTimeIso === 'string' ? parseISO(startTimeIso) : startTimeIso;
  const e = typeof endTimeIso === 'string' ? parseISO(endTimeIso) : endTimeIso;
  return isBefore(s, dayEnd) && isAfter(e, dayStart);
}

/**
 * Generate timeline slots for a day taking into account bookings, blocked slots, and past status
 */
export function generateDaySlots(
  dateStr: string,
  bookings: Booking[] = [],
  blockedSlots: BlockedSlot[] = [],
  settings: AppSettings = DEFAULT_SETTINGS
): TimelineSlot[] {
  const slots: TimelineSlot[] = [];
  const now = getNow();

  const startHour = settings.work_start_hour;
  const endHour = settings.work_end_hour;
  const duration = settings.slot_duration_minutes;

  const totalMinutes = (endHour - startHour) * 60;
  const totalSlots = Math.floor(totalMinutes / duration);

  for (let i = 0; i < totalSlots; i++) {
    const slotStartMinutes = i * duration;
    const hour = startHour + Math.floor(slotStartMinutes / 60);
    const minute = slotStartMinutes % 60;

    const endMinutes = slotStartMinutes + duration;
    const endH = startHour + Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;

    const startTime = createDubaiDateTime(dateStr, hour, minute);
    const endTime = createDubaiDateTime(dateStr, endH, endM);

    const startLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const endLabel = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    // Check if slot is blocked
    const matchedBlock = blockedSlots.find((block) => {
      // Check recurring rule e.g. Friday prayer
      if (block.recurring_rule === 'FRIDAY_12_14') {
        const dayOfWeekDubai = formatInDubai(startTime, 'EEEE');
        if (dayOfWeekDubai === 'Friday') {
          const sHour = parseInt(formatInDubai(startTime, 'H'), 10);
          if (sHour >= 12 && sHour < 14) return true;
        }
      }

      const bStart = parseISO(block.start_time);
      const bEnd = parseISO(block.end_time);
      return isBefore(startTime, bEnd) && isAfter(endTime, bStart);
    });

    // Check if slot is booked
    const matchedBooking = bookings.find((b) => {
      if (b.status !== 'confirmed') return false;
      const bStart = parseISO(b.start_time);
      const bEnd = parseISO(b.end_time);
      return isBefore(startTime, bEnd) && isAfter(endTime, bStart);
    });

    const isPast = isBefore(endTime, now);

    let state: SlotState = 'free';
    if (isPast) {
      state = 'past';
    } else if (matchedBlock) {
      state = 'blocked';
    } else if (matchedBooking) {
      state = 'booked';
    }

    slots.push({
      slotIndex: i,
      startTime,
      endTime,
      startLabel,
      endLabel,
      state,
      booking: matchedBooking,
      blockedSlot: matchedBlock,
    });
  }

  return slots;
}

/**
 * Calculate live "now" line position as a percentage between startHour and endHour
 */
export function getDubaiNowLinePercentage(
  selectedDateStr: string,
  settings: AppSettings = DEFAULT_SETTINGS
): number | null {
  const now = getNow();
  const todayDubaiStr = formatInDubai(now, 'yyyy-MM-dd');

  if (selectedDateStr !== todayDubaiStr) {
    return null;
  }

  const dayStart = createDubaiDateTime(selectedDateStr, settings.work_start_hour, 0);
  const dayEnd = createDubaiDateTime(selectedDateStr, settings.work_end_hour, 0);

  if (isBefore(now, dayStart) || isAfter(now, dayEnd)) {
    return null;
  }

  const total = dayEnd.getTime() - dayStart.getTime();
  const elapsed = now.getTime() - dayStart.getTime();
  const pct = (elapsed / total) * 100;
  return Math.min(100, Math.max(0, pct));
}

/**
 * Compute the dynamic room status banner
 */
export function computeRoomStatus(
  bookings: Booking[] = [],
  blockedSlots: BlockedSlot[] = [],
  settings: AppSettings = DEFAULT_SETTINGS
): RoomStatusInfo {
  const now = getNow();

  // 1. Check current active block
  const currentBlock = blockedSlots.find((block) => {
    if (block.recurring_rule === 'FRIDAY_12_14') {
      const day = formatInDubai(now, 'EEEE');
      const h = parseInt(formatInDubai(now, 'H'), 10);
      if (day === 'Friday' && h >= 12 && h < 14) return true;
    }
    const s = parseISO(block.start_time);
    const e = parseISO(block.end_time);
    return (isBefore(s, now) || isEqual(s, now)) && isAfter(e, now);
  });

  if (currentBlock) {
    const endStr = formatInDubai(currentBlock.end_time, 'HH:mm');
    const msg = `Unavailable until ${endStr} (${currentBlock.title})`;
    return {
      state: 'blocked',
      statusText: msg,
      bannerText: msg,
      currentBlockedSlot: currentBlock,
      nextMeetingSummary: null,
    };
  }

  // 2. Check current active booking
  const confirmed = bookings.filter((b) => b.status === 'confirmed');
  const sorted = [...confirmed].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const currentBooking = sorted.find((b) => {
    const s = parseISO(b.start_time);
    const e = parseISO(b.end_time);
    return (isBefore(s, now) || isEqual(s, now)) && isAfter(e, now);
  });

  const upcomingBookings = sorted.filter((b) => isAfter(parseISO(b.start_time), now));
  const nextBooking = upcomingBookings[0] || null;

  if (currentBooking) {
    const occupiedUntil = formatInDubai(currentBooking.end_time, 'HH:mm');
    let freeFrom = occupiedUntil;
    let curr = currentBooking;

    for (const b of upcomingBookings) {
      if (isEqual(parseISO(b.start_time), parseISO(curr.end_time))) {
        curr = b;
        freeFrom = formatInDubai(curr.end_time, 'HH:mm');
      } else {
        break;
      }
    }

    const nextSummary = nextBooking
      ? `Next: ${nextBooking.title} (${formatInDubai(nextBooking.start_time, 'HH:mm')} – ${formatInDubai(nextBooking.end_time, 'HH:mm')})`
      : null;

    const banner = `Occupied until ${occupiedUntil}, free from ${freeFrom}`;

    return {
      state: 'occupied',
      statusText: banner,
      bannerText: banner,
      currentBooking,
      nextBooking,
      occupiedUntil,
      freeFrom,
      nextMeetingSummary: nextSummary,
    };
  }

  // 3. Room is available
  if (nextBooking) {
    const freeUntil = formatInDubai(nextBooking.start_time, 'HH:mm');
    const banner = `Available now until ${freeUntil}`;
    const nextSummary = `Next: ${nextBooking.title} (${formatInDubai(nextBooking.start_time, 'HH:mm')} – ${formatInDubai(nextBooking.end_time, 'HH:mm')})`;
    return {
      state: 'available',
      statusText: banner,
      bannerText: banner,
      currentBooking: null,
      nextBooking,
      freeUntil,
      nextMeetingSummary: nextSummary,
    };
  }

  return {
    state: 'available',
    statusText: 'Available now',
    bannerText: 'Available now',
    currentBooking: null,
    nextBooking: null,
    nextMeetingSummary: null,
  };
}
