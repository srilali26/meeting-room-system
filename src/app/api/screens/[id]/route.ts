import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { getCurrentAdminSession, getClientIp } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getCurrentAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Admin session required.' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action;

    if (action === 'reload') {
      await Database.requestScreenReload(params.id);
      await Database.logAudit('SCREEN_RELOAD_REQUEST', 'admin', getClientIp(req), { screenId: params.id });
      return NextResponse.json({ message: 'Screen reload command dispatched' });
    }

    if (action === 'regenerate_token') {
      const newToken = await Database.regenerateDisplayToken(params.id);
      await Database.logAudit('SCREEN_TOKEN_REGENERATED', 'admin', getClientIp(req), { screenId: params.id });
      return NextResponse.json({ message: 'Token regenerated', token: newToken });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Screen action failed' }, { status: 500 });
  }
}
