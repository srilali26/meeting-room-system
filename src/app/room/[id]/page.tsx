import { notFound } from 'next/navigation';
import { Database } from '@/lib/db';
import { formatInDubai, generateDaySlots, computeRoomStatus } from '@/lib/timezone';
import { generateRoomQRCodeDataUrl } from '@/lib/qr';
import { RoomClientView } from './RoomClientView';

interface RoomPageProps {
  params: { id: string };
  searchParams?: { date?: string };
}

export const dynamic = 'force-dynamic';

export default async function RoomPage({ params, searchParams }: RoomPageProps) {
  const room = await Database.getRoomById(params.id);
  if (!room) {
    notFound();
  }

  const todayStr = searchParams?.date || formatInDubai(new Date(), 'yyyy-MM-dd');
  const bookings = await Database.getBookings(room.id, todayStr);
  const blockedSlots = await Database.getBlockedSlots(room.id, todayStr);
  const settings = await Database.getSettings();

  const slots = generateDaySlots(todayStr, bookings, blockedSlots, settings);
  const status = computeRoomStatus(bookings, blockedSlots, settings);
  const qrDataUrl = await generateRoomQRCodeDataUrl(room.id);

  return (
    <RoomClientView
      initialRoom={room}
      initialStatus={status}
      initialSlots={slots}
      initialDate={todayStr}
      qrDataUrl={qrDataUrl}
    />
  );
}
