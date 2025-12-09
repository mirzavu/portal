import { NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';
import { calculateDistance, formatDistance } from '@/lib/utils';

export async function GET() {
  try {
    const pb = getPocketBase();
    
    // Get latest bike location
    const bikeLocations = await pb.collection('bike_locations').getList(1, 1, {
      sort: '-timestamp',
    });
    
    // Get latest user location
    const userLocations = await pb.collection('user_locations').getList(1, 1, {
      sort: '-timestamp',
    });
    
    const bikeLocation = bikeLocations.items[0] || null;
    const userLocation = userLocations.items[0] || null;
    
    let distance: number | null = null;
    let distanceFormatted: string | null = null;
    
    if (bikeLocation && userLocation) {
      distance = calculateDistance(
        bikeLocation.latitude,
        bikeLocation.longitude,
        userLocation.latitude,
        userLocation.longitude
      );
      distanceFormatted = formatDistance(distance);
    }
    
    return NextResponse.json({
      bike: bikeLocation ? {
        latitude: bikeLocation.latitude,
        longitude: bikeLocation.longitude,
        speed: bikeLocation.speed,
        satellites: bikeLocation.satellites,
        battery_mv: bikeLocation.battery_mv,
        timestamp: bikeLocation.timestamp,
      } : null,
      user: userLocation ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        accuracy: userLocation.accuracy,
        timestamp: userLocation.timestamp,
      } : null,
      distance,
      distanceFormatted,
    });
  } catch (error: any) {
    console.error('Error fetching bike status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bike status' },
      { status: 500 }
    );
  }
}








