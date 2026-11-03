import { Database } from '@/lib/db';
import { computeRoomStatus } from '@/lib/timezone';
import { HomeClientView } from './HomeClientView';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const rooms = await Database.getRooms();
  const bookings = await Database.getBookings();
  const blockedSlots = await Database.getBlockedSlots();
  const settings = await Database.getSettings();

  const roomsWithStatus = rooms.map((room) => {
    const rBookings = bookings.filter((b) => b.room_id === room.id);
    const rBlocked = blockedSlots.filter((b) => b.room_id === null || b.room_id === room.id);
    const status = computeRoomStatus(rBookings, rBlocked, settings);
    return {
      ...room,
      currentStatus: status,
    };
  });

  return <HomeClientView initialRooms={roomsWithStatus} />;
}
