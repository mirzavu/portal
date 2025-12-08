import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';
import { bikeLocationSchema } from '@/lib/validations';
import { calculateDistance } from '@/lib/utils';
import { sendPushoverNotification } from '@/lib/pushover';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validated = bikeLocationSchema.parse(body);
    
    const pb = getPocketBase();
    
    // Create bike location record
    const record = await pb.collection('bike_locations').create({
      latitude: validated.latitude,
      longitude: validated.longitude,
      satellites: validated.satellites ?? null,
      battery_mv: validated.battery_mv ?? null,
      timestamp: new Date(validated.timestamp * 1000).toISOString(),
    });
    
    // Check user status and distance
    try {
      // Get latest user location/status
      const userLocations = await pb.collection('user_locations').getList(1, 1, {
        sort: '-timestamp',
      });
      
      if (userLocations.items.length > 0) {
        const userStatus = userLocations.items[0];
        
        // Only check distance if user is HOME
        if (userStatus.status === 'home') {
          // We need home coordinates to calculate distance
          // Check if current record has them, or look for last known? 
          // For now, assume they are in the latest record or we can't calculate.
          // Improvement: We could search back for last record with coordinates if null here.
          
          let homeLat = userStatus.home_latitude;
          let homeLon = userStatus.home_longitude;

          if (homeLat != null && homeLon != null) {
            const distance = calculateDistance(
              validated.latitude,
              validated.longitude,
              homeLat,
              homeLon
            );
            
            // Distance threshold: 200m
            if (distance > 200) {
              // Check for recent alerts to avoid spam (e.g. last 15 mins)
              const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
              const recentAlerts = await pb.collection('alerts').getList(1, 1, {
                filter: `type = 'bike_distance' && created >= '${fifteenMinsAgo}'`,
              });
              
              if (recentAlerts.totalItems === 0) {
                const distanceKm = (distance / 1000).toFixed(2);
                const message = `Bike is ${distanceKm}km away from your home location!`;
                 
                // Send Pushover
                await sendPushoverNotification({
                  message: message,
                  title: 'Bike Security Alert',
                  priority: 1, // High priority
                  sound: 'siren'
                });

                // Log alert
                await pb.collection('alerts').create({
                  type: 'bike_distance',
                  message: message,
                  timestamp: new Date().toISOString(),
                  read: false,
                });
              }
            }
          }
        }
      }
    } catch (error) {
      // Logic failure should not fail the request
      console.error('Error checking security logic:', error);
    }
    
    return NextResponse.json(
      { success: true, id: record.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating bike location:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    // Return more detailed error information
    const errorMessage = error?.response?.data || error?.message || 'Failed to create bike location record';
    return NextResponse.json(
      { success: false, error: errorMessage, details: error?.response?.data },
      { status: error?.status || 500 }
    );
  }
}

