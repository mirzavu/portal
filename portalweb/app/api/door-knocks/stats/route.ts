import { NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';

export async function GET() {
  try {
    const pb = getPocketBase();
    
    // Get start of day, week, and month in UTC
    const now = new Date();
    
    // Today (start of day in UTC)
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    
    // This week (Monday in UTC)
    const weekStart = new Date(now);
    const day = weekStart.getUTCDay();
    const diff = weekStart.getUTCDate() - day + (day === 0 ? -6 : 1);
    weekStart.setUTCDate(diff);
    weekStart.setUTCHours(0, 0, 0, 0);
    
    // This month (start of month in UTC)
    const monthStart = new Date(now);
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    
    // Fetch counts for each period
    const [todayResult, weekResult, monthResult] = await Promise.all([
      pb.collection('door_knocks').getList(1, 1, {
        filter: `timestamp >= "${todayStart.toISOString()}"`,
      }),
      pb.collection('door_knocks').getList(1, 1, {
        filter: `timestamp >= "${weekStart.toISOString()}"`,
      }),
      pb.collection('door_knocks').getList(1, 1, {
        filter: `timestamp >= "${monthStart.toISOString()}"`,
      }),
    ]);
    
    return NextResponse.json({
      today: todayResult.totalItems || 0,
      thisWeek: weekResult.totalItems || 0,
      thisMonth: monthResult.totalItems || 0,
    });
  } catch (error: any) {
    console.error('Error fetching door knock statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}


