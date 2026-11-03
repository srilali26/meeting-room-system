import { NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { getCurrentAdminSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getCurrentAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Admin session required.' }, { status: 401 });
    }

    const logs = await Database.getAuditLogs(200);
    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch audit logs' }, { status: 500 });
  }
}
