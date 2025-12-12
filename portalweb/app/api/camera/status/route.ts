import { NextRequest, NextResponse } from 'next/server';

const CLOUD_PROXY_URL = 'http://139.59.66.225:8100';

export async function GET(request: NextRequest) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  try {
    // Use cloud proxy endpoint for status
    const statusUrl = `${CLOUD_PROXY_URL}/status`;
    
    console.log(`[CAMERA STATUS ${requestId}] Starting request`);
    console.log(`[CAMERA STATUS ${requestId}] Fetching status from cloud proxy: ${statusUrl}`);
    console.log(`[CAMERA STATUS ${requestId}] Timeout: 10s`);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[CAMERA STATUS ${requestId}] Request timeout after 10s`);
      controller.abort();
    }, 10000); // 10 second timeout

    try {
      const fetchStartTime = Date.now();
      
      // Forward the request to the cloud proxy
      const response = await fetch(statusUrl, {
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
      console.log(`[CAMERA STATUS ${requestId}] Raw response data:`, JSON.stringify(data).substring(0, 500));
      console.log(`[CAMERA STATUS ${requestId}] Data type:`, typeof data);
      if (typeof data === 'object' && !Array.isArray(data) && data !== null) {
        console.log(`[CAMERA STATUS ${requestId}] Data keys:`, Object.keys(data));
      }

      // Handle the response format: {status: {...}, success: true}
      // Extract the status object if it exists, otherwise return the whole data
      const statusData = data?.status || data;
      console.log(`[CAMERA STATUS ${requestId}] Extracted status data keys:`, 
        typeof statusData === 'object' && statusData !== null ? Object.keys(statusData) : 'N/A');

      // Log the full status for production verification
      console.log(`[CAMERA STATUS ${requestId}] ===== FULL STATUS DATA =====`);
      console.log(`[CAMERA STATUS ${requestId}]`, JSON.stringify(statusData, null, 2));
      console.log(`[CAMERA STATUS ${requestId}] ===== END STATUS DATA =====`);

      // Return the status data
      return NextResponse.json({
        success: true,
        data: statusData,
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
      
      console.error(`[CAMERA STATUS ${requestId}] Network error details:`, {
        cloudProxyUrl: `${CLOUD_PROXY_URL}/status`,
        errorCode: error.code,
        errorMessage: error.message,
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot connect to cloud proxy. Check network connection.',
          details: error.code || error.message,
          cloudProxyUrl: CLOUD_PROXY_URL,
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
