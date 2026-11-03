import { redirect } from 'next/navigation';
import { getCurrentAdminSession } from '@/lib/auth';
import { Database } from '@/lib/db';
import { AdminConsoleClient } from './AdminConsoleClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getCurrentAdminSession();
  if (!session) {
    redirect('/admin/login');
  }

  const rooms = await Database.getRooms();
  const settings = await Database.getSettings();

  return <AdminConsoleClient initialRooms={rooms} initialSettings={settings} />;
}
