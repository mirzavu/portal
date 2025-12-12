import { NextRequest, NextResponse } from 'next/server';

const CLOUD_PROXY_URL = 'http://139.59.66.225:8100';

export async function GET(request: NextRequest) {
  return handleCameraControl(request);
}

export async function POST(request: NextRequest) {
  return handleCameraControl(request);
}

async function handleCameraControl(request: NextRequest) {
  try {
    // Parse the URL to get the endpoint path
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    
    if (!endpoint) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing endpoint parameter. Expected format: ?endpoint=/ptz/up' 
        },
        { status: 400 }
      );
    }

    // Construct the full URL to the cloud proxy
    const controlUrl = `${CLOUD_PROXY_URL}${endpoint}`;
    
    console.log(`[CAMERA CONTROL] Sending request to cloud proxy: ${controlUrl}`);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      // Forward the request to the cloud proxy
      const response = await fetch(controlUrl, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[CAMERA CONTROL] Device returned error: ${response.status} - ${errorText}`);
        
        return NextResponse.json(
          { 
            success: false, 
            error: `Device returned error: ${response.status} ${response.statusText}`,
            command: endpoint 
          },
          { status: response.status }
        );
      }

      const data = await response.json().catch(async () => {
        // If JSON parsing fails, try to get text response
        const text = await response.text();
        return { success: true, command: endpoint, response: text };
      });

      console.log(`[CAMERA CONTROL] Success: ${endpoint}`, data);

      return NextResponse.json({
        success: data.success !== false, // Default to true if not specified
        command: data.command || endpoint,
        error: data.error || undefined,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Check if it was an abort error (timeout)
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Request timeout - device may be unreachable',
            command: endpoint 
          },
          { status: 504 }
        );
      }
      
      // Re-throw to be handled by outer catch
      throw fetchError;
    }

  } catch (error: any) {
    console.error('[CAMERA CONTROL] Error:', error);
    
    // Handle timeout errors (already handled above, but keep for safety)
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Request timeout - device may be unreachable',
          command: 'unknown' 
        },
        { status: 504 }
      );
    }

    // Handle network errors
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot connect to cloud proxy. Check network connection.',
          command: 'unknown' 
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error occurred',
        command: 'unknown' 
      },
      { status: 500 }
    );
  }
}

