import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';
import { presenceDataSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validated = presenceDataSchema.parse(body);

    const pb = getPocketBase();

    // Calculate battery percentage
    const voltage = validated.voltage;
    let batteryPercent = 0;
    if (voltage >= 2.5) { // Only calculate if not on USB power
      if (voltage <= 3.0) {
        batteryPercent = 0;
      } else if (voltage >= 4.2) {
        batteryPercent = 100;
      } else {
        batteryPercent = Math.round(((voltage - 3.0) / 1.2) * 100);
      }
    }

    // Hardware threshold: 30cm or less is treated as "no presence"
    let finalPresence = validated.presence;
    let finalDistance = validated.distance;

    if (finalDistance > 0 && finalDistance <= 30) {
      console.log(`[PRESENCE API] Distance ${finalDistance}cm <= 30cm threshold. Overriding presence to false.`);
      finalPresence = false;
      finalDistance = -1; // Standard "no presence" distance
    }

    // Create record in PocketBase (timestamp generated server-side)
    const record = await pb.collection('presence_data').create({
      presence: finalPresence,
      distance: finalDistance,
      voltage: validated.voltage,
      battery_percent: batteryPercent,
      moving_energy: validated.moving_energy || 0, // Store energy
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      { success: true, id: record.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating presence data:', error);
    if (error.response) {
      console.error('[PB ERROR RESPONSE]:', JSON.stringify(error.response, null, 2));
    }
    if (error.originalError) {
      console.error('[PB ORIGINAL ERROR]:', error.originalError);
    }

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create presence data record' },
      { status: 500 }
    );
  }
}

