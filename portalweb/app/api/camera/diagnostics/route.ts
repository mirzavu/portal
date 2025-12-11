import { NextRequest, NextResponse } from 'next/server';

const CAMERA_DEVICE_PORT = 8100;

/**
 * Diagnostic endpoint to check camera API configuration and connectivity
 * This endpoint helps debug production issues without making full requests
 */
export async function GET(request: NextRequest) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      cameraDeviceIp: process.env.NEXT_PUBLIC_CAMERA_DEVICE_IP ? 'SET' : 'NOT SET',
      cameraDeviceIpValue: process.env.NEXT_PUBLIC_CAMERA_DEVICE_IP 
        ? `${process.env.NEXT_PUBLIC_CAMERA_DEVICE_IP.substring(0, 8)}...` 
        : null,
      cameraPort: CAMERA_DEVICE_PORT,
    },
    connectivity: {
      status: 'pending',
      error: null,
    },
    configuration: {
      status: 'ok',
      issues: [] as string[],
    },
  };

  // Check configuration
  if (!process.env.NEXT_PUBLIC_CAMERA_DEVICE_IP) {
    diagnostics.configuration.status = 'error';
    diagnostics.configuration.issues.push('NEXT_PUBLIC_CAMERA_DEVICE_IP environment variable is not set');
  } else {
    const deviceAddress = process.env.NEXT_PUBLIC_CAMERA_DEVICE_IP;
    const deviceUrl = `http://${deviceAddress}:${CAMERA_DEVICE_PORT}/camera-status`;
    diagnostics.environment.fullUrl = deviceUrl;
    
    // Try a quick connectivity test (with short timeout)
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for diagnostics
      
      const startTime = Date.now();
      const response = await fetch(deviceUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      const duration = Date.now() - startTime;
      
      if (timeoutId) clearTimeout(timeoutId);
      
      diagnostics.connectivity.status = 'success';
      diagnostics.connectivity.responseStatus = response.status;
      diagnostics.connectivity.responseStatusText = response.statusText;
      diagnostics.connectivity.duration = `${duration}ms`;
      diagnostics.connectivity.contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        diagnostics.connectivity.status = 'error';
        diagnostics.connectivity.error = `Device returned ${response.status} ${response.statusText}`;
      }
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      
      diagnostics.connectivity.status = 'error';
      diagnostics.connectivity.error = error.message || 'Unknown error';
      diagnostics.connectivity.errorName = error.name;
      diagnostics.connectivity.errorCode = error.code;
      
      if (error.name === 'AbortError') {
        diagnostics.connectivity.error = 'Connection timeout (device may be unreachable)';
      } else if (error.code === 'ECONNREFUSED') {
        diagnostics.connectivity.error = 'Connection refused (device may be offline or port closed)';
      } else if (error.code === 'ENOTFOUND') {
        diagnostics.connectivity.error = 'Hostname not found (check DNS/Tailscale configuration)';
      } else if (error.code === 'ETIMEDOUT') {
        diagnostics.connectivity.error = 'Connection timeout (network issue or firewall blocking)';
      }
    }
  }

  // Determine overall health status
  const hasConfigIssues = diagnostics.configuration.issues.length > 0;
  const hasConnectivityIssues = diagnostics.connectivity.status === 'error';
  
  diagnostics.health = {
    status: hasConfigIssues || hasConnectivityIssues ? 'unhealthy' : 'healthy',
    summary: hasConfigIssues 
      ? 'Configuration issues detected'
      : hasConnectivityIssues
      ? 'Connectivity issues detected'
      : 'All checks passed',
  };

  const statusCode = hasConfigIssues ? 500 : hasConnectivityIssues ? 503 : 200;
  
  return NextResponse.json(diagnostics, { status: statusCode });
}
