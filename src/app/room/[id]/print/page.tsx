import { notFound } from 'next/navigation';
import { Database } from '@/lib/db';
import { generateRoomQRCodeDataUrl } from '@/lib/qr';
import { PrintSignClientView } from './PrintSignClientView';

interface PrintPageProps {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

export default async function PrintPage({ params }: PrintPageProps) {
  const room = await Database.getRoomById(params.id);
  if (!room) {
    notFound();
  }

  const qrDataUrl = await generateRoomQRCodeDataUrl(room.id);
  const targetUrl = `http://192.168.50.143/room/${room.id}`;

  return <PrintSignClientView room={room} qrDataUrl={qrDataUrl} targetUrl={targetUrl} />;
}
