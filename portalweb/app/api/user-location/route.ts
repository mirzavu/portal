import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';
import { userLocationSchema } from '@/lib/validations';

async function controlCameraPrivacy(status: 'home' | 'away' | 'update') {
  // Only control camera for 'home' and 'away' status
  if (status === 'update') {
    return;
  }

  const deviceAddress = process.env.NEXT_PUBLIC_CAMERA_DEVICE_IP;
  const devicePort = process.env.NEXT_PUBLIC_CAMERA_DEVICE_PORT || '5001';
  
  if (!deviceAddress) {
    console.error('[CAMERA PRIVACY] Camera device IP not configured. Please set NEXT_PUBLIC_CAMERA_DEVICE_IP environment variable.');
    return;
  }

  const privacyAction = status === 'home' ? 'on' : 'off';
  const cameraUrl = `http://${deviceAddress}:${devicePort}/privacy/${privacyAction}`;

  try {
    console.log(`[CAMERA PRIVACY] Setting privacy ${privacyAction} for status: ${status}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(cameraUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[CAMERA PRIVACY] Failed to set privacy ${privacyAction}: ${response.status} ${response.statusText}`);
      return;
    }

    console.log(`[CAMERA PRIVACY] Successfully set privacy ${privacyAction}`);
  } catch (error: any) {
    // Log error but don't fail the main request
    if (error.name === 'AbortError') {
      console.error(`[CAMERA PRIVACY] Timeout setting privacy ${privacyAction}`);
    } else {
      console.error(`[CAMERA PRIVACY] Error setting privacy ${privacyAction}:`, error.message);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validated = userLocationSchema.parse(body);
    
    const pb = getPocketBase();
    
    // Create user location record with current server time
    const record = await pb.collection('user_locations').create({
      status: validated.status,
      home_latitude: validated.home_latitude ?? null,
      home_longitude: validated.home_longitude ?? null,
      timestamp: new Date().toISOString(),
    });
    
    // Control camera privacy based on status (non-blocking)
    // Don't await - let it run in background so it doesn't delay the response
    controlCameraPrivacy(validated.status).catch((error) => {
      console.error('[CAMERA PRIVACY] Unhandled error:', error);
    });
    
    return NextResponse.json(
      { success: true, id: record.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating user location:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    // Return more detailed error information
    const errorMessage = error?.response?.data || error?.message || 'Failed to create user location record';
    return NextResponse.json(
      { success: false, error: errorMessage, details: error?.response?.data },
      { status: error?.status || 500 }
    );
  }
}

