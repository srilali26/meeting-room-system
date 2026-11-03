import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { getCurrentAdminSession, getClientIp } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getCurrentAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Admin session required.' }, { status: 401 });
    }

    const success = await Database.deleteBlockedSlot(params.id);
    if (!success) {
      return NextResponse.json({ error: 'Blocked slot not found' }, { status: 404 });
    }

    await Database.logAudit('DELETE_BLOCKED_SLOT', 'admin', getClientIp(req), {
      blockId: params.id,
    });

    return NextResponse.json({ message: 'Blocked slot removed successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to remove blocked slot' }, { status: 500 });
  }
}
