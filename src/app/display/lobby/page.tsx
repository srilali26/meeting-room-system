import { Database } from '@/lib/db';
import { generateRoomQRCodeDataUrl } from '@/lib/qr';
import { formatInDubai } from '@/lib/timezone';
import { LobbyClientView } from './LobbyClientView';

export const dynamic = 'force-dynamic';

export default async function LobbyPage() {
  const todayDubaiStr = formatInDubai(new Date(), 'yyyy-MM-dd');
  const rooms = await Database.getRooms();
  const bookings = await Database.getBookings(undefined, todayDubaiStr);
  const blockedSlots = await Database.getBlockedSlots(undefined, todayDubaiStr);
  // Generate QR for root url
  const directoryQr = await generateRoomQRCodeDataUrl('');

  return (
    <LobbyClientView
      initialRooms={rooms}
      initialBookings={bookings}
      initialBlockedSlots={blockedSlots}
      directoryQrDataUrl={directoryQr}
    />
  );
}
