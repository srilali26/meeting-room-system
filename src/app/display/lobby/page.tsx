import { Database } from '@/lib/db';
import { generateRoomQRCodeDataUrl } from '@/lib/qr';
import { LobbyClientView } from './LobbyClientView';

export const dynamic = 'force-dynamic';

export default async function LobbyPage() {
  const rooms = await Database.getRooms();
  const bookings = await Database.getBookings();
  const blockedSlots = await Database.getBlockedSlots();
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
