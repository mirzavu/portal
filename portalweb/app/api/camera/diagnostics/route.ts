import { NextRequest, NextResponse } from 'next/server';

/**
 * Diagnostic endpoint to check camera API configuration and connectivity
 * This endpoint helps debug production issues without making full requests
 */
export async function GET(request: NextRequest) {
  const cloudProxyUrl = process.env.CAMERA_PROXY_URL;
  
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      cloudProxyUrl: cloudProxyUrl || 'NOT SET',
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
  if (!cloudProxyUrl) {
    diagnostics.configuration.status = 'error';
    diagnostics.configuration.issues.push('CAMERA_PROXY_URL environment variable is not set');
    diagnostics.health = {
      status: 'unhealthy',
      summary: 'Configuration issues detected',
    };
    return NextResponse.json(diagnostics, { status: 500 });
  }

  // Test connectivity to cloud proxy
  const statusUrl = `${cloudProxyUrl}/status`;
  diagnostics.environment.fullUrl = statusUrl;
    
  // Try a quick connectivity test (with short timeout)
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for diagnostics
    
    const startTime = Date.now();
    const response = await fetch(statusUrl, {
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
      diagnostics.connectivity.error = `Cloud proxy returned ${response.status} ${response.statusText}`;
    }
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    
    diagnostics.connectivity.status = 'error';
    diagnostics.connectivity.error = error.message || 'Unknown error';
    diagnostics.connectivity.errorName = error.name;
    diagnostics.connectivity.errorCode = error.code;
    
    if (error.name === 'AbortError') {
      diagnostics.connectivity.error = 'Connection timeout (cloud proxy may be unreachable)';
    } else if (error.code === 'ECONNREFUSED') {
      diagnostics.connectivity.error = 'Connection refused (cloud proxy may be offline or port closed)';
    } else if (error.code === 'ENOTFOUND') {
      diagnostics.connectivity.error = 'Hostname not found (check DNS/network configuration)';
    } else if (error.code === 'ETIMEDOUT') {
      diagnostics.connectivity.error = 'Connection timeout (network issue or firewall blocking)';
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


