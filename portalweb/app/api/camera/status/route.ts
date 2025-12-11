import { NextRequest, NextResponse } from 'next/server';

const CAMERA_DEVICE_PORT = 8100;

export async function GET(request: NextRequest) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  try {
    const deviceAddress = process.env.NEXT_PUBLIC_CAMERA_DEVICE_IP;
    
    // Enhanced logging for environment variable check
    console.log(`[CAMERA STATUS ${requestId}] Starting request`);
    console.log(`[CAMERA STATUS ${requestId}] Environment check - NEXT_PUBLIC_CAMERA_DEVICE_IP:`, 
      deviceAddress ? `${deviceAddress.substring(0, 8)}...` : 'NOT SET');
    
    if (!deviceAddress) {
      console.error(`[CAMERA STATUS ${requestId}] ERROR: Camera device IP not configured`);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Camera device IP not configured. Please set NEXT_PUBLIC_CAMERA_DEVICE_IP environment variable.',
          requestId,
        },
        { status: 500 }
      );
    }

    // Construct the full URL to the camera device
    // Supports both IP addresses (100.x.x.x) and MagicDNS hostnames (device.tailnet.ts.net)
    const deviceUrl = `http://${deviceAddress}:${CAMERA_DEVICE_PORT}/camera-status`;
    
    console.log(`[CAMERA STATUS ${requestId}] Fetching status from: ${deviceUrl}`);
    console.log(`[CAMERA STATUS ${requestId}] Port: ${CAMERA_DEVICE_PORT}, Timeout: 10s`);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[CAMERA STATUS ${requestId}] Request timeout after 10s`);
      controller.abort();
    }, 10000); // 10 second timeout

    try {
      const fetchStartTime = Date.now();
      
      // Forward the request to the camera device
      const response = await fetch(deviceUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      const fetchDuration = Date.now() - fetchStartTime;
      clearTimeout(timeoutId);

      console.log(`[CAMERA STATUS ${requestId}] Response received in ${fetchDuration}ms`);
      console.log(`[CAMERA STATUS ${requestId}] Status: ${response.status} ${response.statusText}`);
      console.log(`[CAMERA STATUS ${requestId}] Headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorText: string;
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = `Failed to read error response: ${e}`;
        }
        
        console.error(`[CAMERA STATUS ${requestId}] Device returned error: ${response.status}`);
        console.error(`[CAMERA STATUS ${requestId}] Error body:`, errorText.substring(0, 500));
        
        return NextResponse.json(
          { 
            success: false, 
            error: `Device returned error: ${response.status} ${response.statusText}`,
            details: errorText.substring(0, 200),
            requestId,
          },
          { status: response.status }
        );
      }

      // Try to parse as JSON first
      let data: any;
      const contentType = response.headers.get('content-type') || '';
      console.log(`[CAMERA STATUS ${requestId}] Content-Type: ${contentType}`);

      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
          console.log(`[CAMERA STATUS ${requestId}] Successfully parsed JSON response`);
        } catch (jsonError: any) {
          console.error(`[CAMERA STATUS ${requestId}] JSON parse error:`, jsonError.message);
          const text = await response.text();
          console.error(`[CAMERA STATUS ${requestId}] Raw response (first 500 chars):`, text.substring(0, 500));
          data = { raw: text, parseError: jsonError.message };
        }
      } else {
        // Non-JSON response
        const text = await response.text();
        console.warn(`[CAMERA STATUS ${requestId}] Non-JSON response received`);
        console.warn(`[CAMERA STATUS ${requestId}] Response (first 500 chars):`, text.substring(0, 500));
        data = { raw: text, contentType };
      }

      const totalDuration = Date.now() - startTime;
      console.log(`[CAMERA STATUS ${requestId}] Request completed successfully in ${totalDuration}ms`);
      console.log(`[CAMERA STATUS ${requestId}] Data type:`, typeof data);
      if (typeof data === 'object' && !Array.isArray(data) && data !== null) {
        console.log(`[CAMERA STATUS ${requestId}] Data keys:`, Object.keys(data));
      }

      // Return the data directly - it's already the status object from the camera
      return NextResponse.json({
        success: true,
        data: data,
        requestId,
        duration: totalDuration,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      const fetchDuration = Date.now() - startTime;
      
      console.error(`[CAMERA STATUS ${requestId}] Fetch error after ${fetchDuration}ms:`, {
        name: fetchError.name,
        message: fetchError.message,
        stack: fetchError.stack?.split('\n').slice(0, 5).join('\n'),
        cause: fetchError.cause,
      });
      
      // Check if it was an abort error (timeout)
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Request timeout - device may be unreachable',
            requestId,
            duration: fetchDuration,
          },
          { status: 504 }
        );
      }
      
      // Re-throw to be handled by outer catch
      throw fetchError;
    }

  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    
    console.error(`[CAMERA STATUS ${requestId}] Outer catch - Error after ${totalDuration}ms:`, {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 10).join('\n'),
      cause: error.cause,
      code: error.code,
    });
    
    // Handle timeout errors
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Request timeout - device may be unreachable',
          requestId,
          duration: totalDuration,
        },
        { status: 504 }
      );
    }

    // Handle network errors with more detail
    if (error.message?.includes('fetch failed') || 
        error.message?.includes('ECONNREFUSED') ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT') {
      
      const deviceAddress = process.env.NEXT_PUBLIC_CAMERA_DEVICE_IP;
      const deviceUrl = deviceAddress ? `http://${deviceAddress}:${CAMERA_DEVICE_PORT}/camera-status` : 'unknown';
      
      console.error(`[CAMERA STATUS ${requestId}] Network error details:`, {
        deviceUrl,
        errorCode: error.code,
        errorMessage: error.message,
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot connect to camera device. Check Tailscale connection and device IP.',
          details: error.code || error.message,
          deviceUrl: deviceAddress ? `${deviceAddress}:${CAMERA_DEVICE_PORT}` : 'not configured',
          requestId,
          duration: totalDuration,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error occurred',
        errorName: error.name,
        errorCode: error.code,
        requestId,
        duration: totalDuration,
      },
      { status: 500 }
    );
  }
}
