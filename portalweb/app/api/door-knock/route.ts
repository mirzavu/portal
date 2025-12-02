import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';
import { doorKnockSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validated = doorKnockSchema.parse(body);
    
    const pb = getPocketBase();
    
    // Create record in PocketBase (timestamp generated server-side)
    const record = await pb.collection('door_knocks').create({
      mac: validated.mac,
      knock_count: validated.knock_count,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      { success: true, id: record.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating door knock:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to create door knock record' },
      { status: 500 }
    );
  }
}
