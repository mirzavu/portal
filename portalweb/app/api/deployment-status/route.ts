import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    // Try to read deployment timestamp file
    // In production, this will be in the release directory
    // In development, it won't exist
    const deploymentTimestampPath = join(process.cwd(), '.deployment-timestamp');
    const deploymentInfoPath = join(process.cwd(), 'DEPLOYMENT_INFO.txt');
    
    let deploymentTimestamp: string | null = null;
    let deploymentInfo: string | null = null;
    
    if (existsSync(deploymentTimestampPath)) {
      try {
        deploymentTimestamp = readFileSync(deploymentTimestampPath, 'utf-8').trim();
      } catch (error) {
        console.error('Error reading deployment timestamp:', error);
      }
    }
    
    if (existsSync(deploymentInfoPath)) {
      try {
        deploymentInfo = readFileSync(deploymentInfoPath, 'utf-8').trim();
      } catch (error) {
        console.error('Error reading deployment info:', error);
      }
    }
    
    // Get current working directory to verify we're running from the correct location
    const currentDir = process.cwd();
    
    // Get process info
    const processInfo = {
      cwd: currentDir,
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
    };
    
    return NextResponse.json({
      deployment: {
        timestamp: deploymentTimestamp,
        info: deploymentInfo,
        deployed: deploymentTimestamp !== null,
      },
      process: processInfo,
      // Add a test value that can be changed to verify deployments
      testValue: 'deployment-test-v4-safe-mode-verified',
    });
  } catch (error: any) {
    console.error('Error fetching deployment status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch deployment status',
        details: error.message 
      },
      { status: 500 }
    );
  }
}








