import { NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';

export async function GET() {
  try {
    const pb = getPocketBase();

    // Authenticate as admin for server-side access
    // This is needed when access rules require authentication
    const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@portal.demotesting.co.uk';
    const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD || '12345678';

    try {
      await pb.admins.authWithPassword(adminEmail, adminPassword);
    } catch (authError) {
      // If auth fails, try without auth (for public collections)
      console.log('Admin auth failed, trying without auth');
    }

    // Get latest presence data record
    const presenceData = await pb.collection('presence_data').getList(1, 1, {
      sort: '-timestamp',
    });

    const latest = presenceData.items[0] || null;

    if (!latest) {
      return NextResponse.json({
        presence: null,
      });
    }

    return NextResponse.json({
      presence: latest.presence ?? false,
      distance: latest.distance ?? -1,
      voltage: latest.voltage ?? 0,
      battery_percent: latest.battery_percent ?? 0,
      moving_energy: latest.moving_energy ?? 0,
      timestamp: latest.timestamp ?? new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching latest presence data:', error);
    console.error('Error details:', error?.response?.data || error?.message);
    // Return null instead of error to prevent frontend crashes
    return NextResponse.json({
      presence: null,
    });
  }
}

