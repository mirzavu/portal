import { NextResponse } from 'next/server';

export const maxDuration = 30; // Allow up to 30 seconds for large payloads

export async function POST(request: Request) {
  try {
    // Accept whatever comes in - no validation, no parsing, just log it
    const rawBody = await request.text();
    
    // Log whatever we received
    console.log('[DEVICE-DEBUG] Raw body length:', rawBody.length);
    console.log('[DEVICE-DEBUG] Raw body:', rawBody);
    
    // Always return success - accept anything
    return NextResponse.json({ 
      success: true, 
      message: 'Debug data received and logged',
      timestamp: Date.now()
    });
  } catch (error: any) {
    // Even on error, return success to not break device flow
    console.error('[DEVICE-DEBUG] Error:', error);
    return NextResponse.json(
      { 
        success: true, 
        message: 'Debug data logged (with errors)',
        error: error.message 
      },
      { status: 200 }
    );
  }
}






