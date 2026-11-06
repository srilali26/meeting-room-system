import { notFound } from 'next/navigation';
import { Database } from '@/lib/db';
import { generateRoomQRCodeDataUrl } from '@/lib/qr';
import { formatInDubai } from '@/lib/timezone';
import { DisplayClientView } from './DisplayClientView';

interface DisplayPageProps {
  params: { roomId: string };
}

export const dynamic = 'force-dynamic';

export default async function DisplayPage({ params }: DisplayPageProps) {
  const room = await Database.getRoomById(params.roomId);
  if (!room) {
    notFound();
  }

  const todayDubaiStr = formatInDubai(new Date(), 'yyyy-MM-dd');
  const qrDataUrl = await generateRoomQRCodeDataUrl(room.id);
  const bookings = await Database.getBookings(room.id, todayDubaiStr);
  const blockedSlots = await Database.getBlockedSlots(room.id, todayDubaiStr);
  const screens = await Database.getDisplayScreens();
  const screen = screens.find((s) => s.room_id === room.id);
  const displayToken = screen ? screen.display_token : `token-screen-${room.id}`;

  return (
    <DisplayClientView
      room={room}
      qrDataUrl={qrDataUrl}
      initialBookings={bookings}
      initialBlockedSlots={blockedSlots}
      displayToken={displayToken}
    />
  );
}
