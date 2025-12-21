import { NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';

export async function GET() {
  try {
    console.log('[DOOR-KNOCKS STATS API] Request received');
    const pb = getPocketBase();
    console.log('[DOOR-KNOCKS STATS API] PocketBase client baseUrl:', pb.baseUrl);
    
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
    
    console.log('[DOOR-KNOCKS STATS API] Fetching stats with filters:', {
      today: todayStart.toISOString(),
      week: weekStart.toISOString(),
      month: monthStart.toISOString()
    });
    
    // Fetch counts for each period
    console.log('[DOOR-KNOCKS STATS API] Starting sequential requests to avoid autocancellation...');
    // Make requests sequential instead of parallel to avoid PocketBase SDK autocancellation
    const todayResult = await pb.collection('door_knocks').getList(1, 1, {
      filter: `timestamp >= "${todayStart.toISOString()}"`,
    });
    console.log('[DOOR-KNOCKS STATS API] Today result:', todayResult.totalItems);
    
    const weekResult = await pb.collection('door_knocks').getList(1, 1, {
      filter: `timestamp >= "${weekStart.toISOString()}"`,
    });
    console.log('[DOOR-KNOCKS STATS API] Week result:', weekResult.totalItems);
    
    const monthResult = await pb.collection('door_knocks').getList(1, 1, {
      filter: `timestamp >= "${monthStart.toISOString()}"`,
    });
    console.log('[DOOR-KNOCKS STATS API] Month result:', monthResult.totalItems);
    
    console.log('[DOOR-KNOCKS STATS API] All requests completed successfully:', {
      today: todayResult.totalItems,
      week: weekResult.totalItems,
      month: monthResult.totalItems
    });
    
    return NextResponse.json({
      today: todayResult.totalItems || 0,
      thisWeek: weekResult.totalItems || 0,
      thisMonth: monthResult.totalItems || 0,
    });
  } catch (error: any) {
    console.error('[DOOR-KNOCKS STATS API] Error fetching door knock statistics:', error);
    console.error('[DOOR-KNOCKS STATS API] Error name:', error?.name);
    console.error('[DOOR-KNOCKS STATS API] Error message:', error?.message);
    console.error('[DOOR-KNOCKS STATS API] Error status:', error?.status);
    console.error('[DOOR-KNOCKS STATS API] Error isAbort:', error?.isAbort);
    console.error('[DOOR-KNOCKS STATS API] Error response:', error?.response);
    console.error('[DOOR-KNOCKS STATS API] Error originalError:', error?.originalError);
    return NextResponse.json(
      { 
        error: 'Failed to fetch statistics',
        details: error?.message || 'Unknown error',
        status: error?.status || 500
      },
      { status: 500 }
    );
  }
}




