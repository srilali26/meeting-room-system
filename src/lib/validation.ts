import { z } from 'zod';
import { isAfter, parseISO, differenceInMinutes } from 'date-fns';
import { formatInDubai } from './timezone';

export const bookingFormSchema = z
  .object({
    room_id: z.string().min(1, { message: 'Room ID is required' }),
    title: z.string().min(2, { message: 'Meeting title must be at least 2 characters' }).max(100),
    organizer_name: z.string().min(2, { message: 'Full name must be at least 2 characters' }).max(100),
    organizer_email: z.string().email({ message: 'Please enter a valid company email address' }),
    start_time: z.string().datetime({ offset: true, message: 'Invalid start time' }),
    end_time: z.string().datetime({ offset: true, message: 'Invalid end time' }),
    notes: z.string().max(500, { message: 'Notes cannot exceed 500 characters' }).optional().nullable(),
  })
  .refine(
    (data) => {
      const start = parseISO(data.start_time);
      const end = parseISO(data.end_time);
      return isAfter(end, start);
    },
    {
      message: 'End time must be after start time',
      path: ['end_time'],
    }
  )
  .refine(
    (data) => {
      const start = parseISO(data.start_time);
      const end = parseISO(data.end_time);
      const durationMinutes = differenceInMinutes(end, start);
      return durationMinutes <= 240; // Max 4 hours
    },
    {
      message: 'Booking duration cannot exceed 4 hours',
      path: ['end_time'],
    }
  )
  .refine(
    (data) => {
      const start = parseISO(data.start_time);
      const end = parseISO(data.end_time);
      const durationMinutes = differenceInMinutes(end, start);
      return durationMinutes >= 15;
    },
    {
      message: 'Booking duration must be at least 15 minutes',
      path: ['end_time'],
    }
  )
  .refine(
    (data) => {
      const start = parseISO(data.start_time);
      // 2-minute buffer for client clock variance
      const nowBuffer = new Date(Date.now() - 2 * 60 * 1000);
      return isAfter(start, nowBuffer);
    },
    {
      message: 'Cannot book meetings in the past',
      path: ['start_time'],
    }
  )
  .refine(
    (data) => {
      const startHour = parseInt(formatInDubai(data.start_time, 'H'), 10);
      const endHour = parseInt(formatInDubai(data.end_time, 'H'), 10);
      const endMin = parseInt(formatInDubai(data.end_time, 'm'), 10);

      const isStartValid = startHour >= 8 && startHour < 20;
      const isEndValid = endHour < 20 || (endHour === 20 && endMin === 0);
      return isStartValid && isEndValid;
    },
    {
      message: 'Bookings are only permitted within standard working hours (08:00 to 20:00 Dubai time)',
      path: ['start_time'],
    }
  );

export type BookingFormData = z.infer<typeof bookingFormSchema>;

export const blockSlotSchema = z
  .object({
    room_id: z.string().nullable().optional(),
    title: z.string().min(2, { message: 'Block reason / title is required' }).max(100),
    reason: z.string().max(300).optional().nullable(),
    start_time: z.string().datetime({ offset: true, message: 'Invalid start time' }),
    end_time: z.string().datetime({ offset: true, message: 'Invalid end time' }),
    recurring_rule: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      const start = parseISO(data.start_time);
      const end = parseISO(data.end_time);
      return isAfter(end, start);
    },
    {
      message: 'End time must be after start time',
      path: ['end_time'],
    }
  );

export const adminLoginSchema = z.object({
  username: z.string().min(1, { message: 'Username is required' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

export const pinUnlockSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, { message: 'PIN must be 4 to 6 numeric digits' }),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, { message: 'Current password is required' }),
  new_password: z.string().min(8, { message: 'New password must be at least 8 characters' }),
});

export const changePinSchema = z.object({
  current_password: z.string().min(1, { message: 'Admin password is required to update PIN' }),
  new_pin: z.string().regex(/^\d{4,6}$/, { message: 'New PIN must be 4 to 6 numeric digits' }),
});

export const roomSchema = z.object({
  name: z.string().min(2, { message: 'Room name must be at least 2 characters' }),
  location: z.string().min(2, { message: 'Location/floor is required' }),
  capacity: z.number().int().positive({ message: 'Capacity must be at least 1 person' }),
  amenities: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
});

export const settingsSchema = z.object({
  work_start_hour: z.number().int().min(0).max(23),
  work_end_hour: z.number().int().min(1).max(24),
  slot_duration_minutes: z.number().int().refine((val) => [15, 30, 60].includes(val)),
  max_booking_duration_hours: z.number().int().min(1).max(12),
  max_advance_booking_days: z.number().int().min(1).max(365),
  privacy_mode: z.boolean(),
  inactivity_lock_minutes: z.number().int().min(1).max(120),
});
