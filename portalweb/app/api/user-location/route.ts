import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';
import { userLocationSchema } from '@/lib/validations';

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

