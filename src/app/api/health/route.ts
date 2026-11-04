import { NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { formatInDubai } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Verify PostgreSQL connection and metadata
    const dbStatus = await Database.testConnection();

    // 2. Query rooms and settings to ensure tables are readable
    const rooms = await Database.getRooms();
    const settings = await Database.getSettings();
    const nowDubai = formatInDubai(new Date(), 'yyyy-MM-dd HH:mm:ss (z)');

    return NextResponse.json({
      status: 'healthy',
      database: {
        connected: true,
        name: dbStatus.database,
        serverTime: dbStatus.serverTime,
        version: dbStatus.version,
      },
      server_ip: '192.168.50.143',
      timezone: 'Asia/Dubai (UTC+4)',
      currentTimeDubai: nowDubai,
      roomsCount: rooms.length,
      settings: {
        work_hours: `${settings.work_start_hour}:00 - ${settings.work_end_hour}:00`,
        slot_duration: `${settings.slot_duration_minutes} min`,
        privacy_mode: settings.privacy_mode,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: {
          connected: false,
          error: error.message || 'Failed to connect to PostgreSQL',
        },
        error: error.message || 'Health check failed',
      },
      { status: 503 }
    );
  }
}
