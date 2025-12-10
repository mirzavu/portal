import { NextRequest, NextResponse } from 'next/server';

const CAMERA_DEVICE_PORT = 8100;

export async function GET(request: NextRequest) {
  try {
    const deviceAddress = process.env.NEXT_PUBLIC_CAMERA_DEVICE_IP;
    
    if (!deviceAddress) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Camera device IP not configured. Please set NEXT_PUBLIC_CAMERA_DEVICE_IP environment variable.' 
        },
        { status: 500 }
      );
    }

    // Construct the full URL to the camera device
    // Supports both IP addresses (100.x.x.x) and MagicDNS hostnames (device.tailnet.ts.net)
    const deviceUrl = `http://${deviceAddress}:${CAMERA_DEVICE_PORT}/camera-status`;
    
    console.log(`[CAMERA STATUS] Fetching status from: ${deviceUrl}`);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      // Forward the request to the camera device
      const response = await fetch(deviceUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[CAMERA STATUS] Device returned error: ${response.status} - ${errorText}`);
        
        return NextResponse.json(
          { 
            success: false, 
            error: `Device returned error: ${response.status} ${response.statusText}` 
          },
          { status: response.status }
        );
      }

      const data = await response.json().catch(async () => {
        // If JSON parsing fails, try to get text response
        const text = await response.text();
        return text;
      });

      console.log(`[CAMERA STATUS] Raw response from device:`, data);
      console.log(`[CAMERA STATUS] Data type:`, typeof data);
      console.log(`[CAMERA STATUS] Data keys:`, typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : 'N/A');

      // Return the data directly - it's already the status object from the camera
      return NextResponse.json({
        success: true,
        data: data,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Check if it was an abort error (timeout)
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Request timeout - device may be unreachable'
          },
          { status: 504 }
        );
      }
      
      // Re-throw to be handled by outer catch
      throw fetchError;
    }

  } catch (error: any) {
    console.error('[CAMERA STATUS] Error:', error);
    
    // Handle timeout errors
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Request timeout - device may be unreachable'
        },
        { status: 504 }
      );
    }

    // Handle network errors
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot connect to camera device. Check Tailscale connection and device IP.'
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
