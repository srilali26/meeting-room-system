import { notFound } from 'next/navigation';
import { Database } from '@/lib/db';
import { generateRoomQRCodeDataUrl } from '@/lib/qr';
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

  const qrDataUrl = await generateRoomQRCodeDataUrl(room.id);
  const bookings = await Database.getBookings(room.id);
  const blockedSlots = await Database.getBlockedSlots(room.id);

  return (
    <DisplayClientView
      room={room}
      qrDataUrl={qrDataUrl}
      initialBookings={bookings}
      initialBlockedSlots={blockedSlots}
    />
  );
}
