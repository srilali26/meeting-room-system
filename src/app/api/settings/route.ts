import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { getCurrentAdminSession, getClientIp } from '@/lib/auth';
import { settingsSchema } from '@/lib/validation';

export async function GET() {
  try {
    const settings = await Database.getSettings();
    return NextResponse.json({ settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Admin session required.' }, { status: 401 });
    }

    const body = await req.json();
    const validated = settingsSchema.partial().parse(body);

    const updated = await Database.updateSettings(validated);

    await Database.logAudit('UPDATE_SETTINGS', 'admin', getClientIp(req), {
      updatedKeys: Object.keys(validated),
    });

    return NextResponse.json({ settings: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.errors ? error.errors[0]?.message : error.message || 'Failed to update settings' },
      { status: 400 }
    );
  }
}
