import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface PM2Process {
  id: number;
  name: string;
  status: string;
  uptime: number;
  memory: number;
  restarts?: number;
  description?: string;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}

function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)}mb`;
}

export async function GET() {
  try {
    let pm2Data: any[];
    
    // First, try to run pm2 locally (if we're on the production server)
    try {
      const { stdout } = await execAsync('pm2 jlist', { timeout: 5000 });
      pm2Data = JSON.parse(stdout);
    } catch (localError: any) {
      // If local pm2 fails, try SSH to production server
      const sshHost = process.env.PM2_SSH_HOST || 'dev@139.59.66.225';
      const sshPassword = process.env.PM2_SSH_PASSWORD;
      
      try {
        let sshCommand: string;
        
        // Try with sshpass if password is provided
        if (sshPassword) {
          sshCommand = `sshpass -p '${sshPassword}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${sshHost} 'pm2 jlist'`;
        } else {
          // Try with SSH key-based auth
          sshCommand = `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${sshHost} 'pm2 jlist'`;
        }
        
        const { stdout } = await execAsync(sshCommand, { timeout: 10000 });
        pm2Data = JSON.parse(stdout);
      } catch (sshError: any) {
        console.error('Error fetching PM2 data via SSH:', sshError.message);
        // Return mock data for development/testing
        return NextResponse.json({
          processes: getMockPM2Data(),
          total: getMockPM2Data().length,
          online: getMockPM2Data().filter(p => p.status === 'online').length,
          error: 'Could not connect to production server. Showing mock data.',
        });
      }
    }
    
    // Process PM2 data into a cleaner format
    const processes: PM2Process[] = pm2Data.map((proc: any) => {
      const uptime = proc.pm2_env?.status === 'online' 
        ? Date.now() - proc.pm2_env.pm_uptime 
        : 0;
      
      return {
        id: proc.pm_id,
        name: proc.name,
        status: proc.pm2_env?.status || 'unknown',
        uptime: Math.floor(uptime / 1000), // Convert to seconds
        memory: proc.monit?.memory || 0,
        restarts: proc.pm2_env?.restart_time || 0,
      };
    });
    
    // Add descriptions based on process names
    const processesWithDescriptions = processes.map(proc => {
      let description = '';
      if (proc.name.includes('pb') || proc.name.includes('pocketbase')) {
        description = 'PocketBase instance';
        if (proc.name === 'portal-pb') {
          description = 'PocketBase for portal.demotesting.co.uk (port 8095)';
        } else if (proc.name === 'invoice-pb') {
          description = 'PocketBase for invoicerightaway.com (port 8090)';
        }
      } else if (proc.name.includes('server')) {
        if (proc.name === 'portal-web') {
          description = 'Next.js frontend for portal.demotesting.co.uk';
        } else if (proc.name === 'invoice-server') {
          description = 'Node.js server for invoicerightaway.com';
        } else {
          description = 'Node.js server';
        }
      } else if (proc.name.includes('api')) {
        description = 'API server';
      }
      
      return { ...proc, description };
    });
    
    // Format the response
    const formatted = processesWithDescriptions.map(proc => ({
      ...proc,
      uptimeFormatted: formatUptime(proc.uptime),
      memoryFormatted: formatMemory(proc.memory),
    }));
    
    return NextResponse.json({
      processes: formatted,
      total: formatted.length,
      online: formatted.filter(p => p.status === 'online').length,
    });
  } catch (error: any) {
    console.error('Error fetching PM2 status:', error);
    const mockData = getMockPM2Data();
    return NextResponse.json(
      { 
        processes: mockData,
        total: mockData.length,
        online: mockData.filter(p => p.status === 'online').length,
        error: 'Failed to fetch PM2 status. Showing mock data.',
        details: error.message,
      },
      { status: 200 } // Return 200 so frontend can still display mock data
    );
  }
}

// Mock data for development/testing
function getMockPM2Data() {
  return [
    {
      id: 2,
      name: 'email-tracker-api',
      status: 'online',
      uptime: 691200, // 8 days in seconds
      uptimeFormatted: '8 days',
      memory: 34393292,
      memoryFormatted: '32.8mb',
      description: 'API server',
    },
    {
      id: 1,
      name: 'email-tracker-pb',
      status: 'online',
      uptime: 691200,
      uptimeFormatted: '8 days',
      memory: 19398656,
      memoryFormatted: '18.5mb',
      description: 'PocketBase instance',
    },
    {
      id: 9,
      name: 'invoice-pb',
      status: 'online',
      uptime: 6060,
      uptimeFormatted: '101 minutes',
      memory: 12163481,
      memoryFormatted: '11.6mb',
      description: 'PocketBase for invoicerightaway.com (port 8090)',
    },
    {
      id: 3,
      name: 'invoice-server',
      status: 'online',
      uptime: 6060,
      uptimeFormatted: '101 minutes',
      memory: 23802675,
      memoryFormatted: '22.7mb',
      restarts: 112,
      description: 'Node.js server for invoicerightaway.com',
    },
    {
      id: 5,
      name: 'meetme-pb',
      status: 'online',
      uptime: 691200,
      uptimeFormatted: '8 days',
      memory: 5033164,
      memoryFormatted: '4.8mb',
      description: 'PocketBase instance',
    },
    {
      id: 4,
      name: 'meetme-server',
      status: 'online',
      uptime: 691200,
      uptimeFormatted: '8 days',
      memory: 11848908,
      memoryFormatted: '11.3mb',
      description: 'Node.js server',
    },
    {
      id: 10,
      name: 'portal-pb',
      status: 'online',
      uptime: 116,
      uptimeFormatted: '116 seconds',
      memory: 34308116,
      memoryFormatted: '32.7mb',
      description: 'PocketBase for portal.demotesting.co.uk (port 8095)',
    },
    {
      id: 8,
      name: 'portal-web',
      status: 'online',
      uptime: 691200,
      uptimeFormatted: '8 days',
      memory: 71093452,
      memoryFormatted: '67.8mb',
      description: 'Next.js frontend for portal.demotesting.co.uk',
    },
    {
      id: 0,
      name: 'vlogmate-server',
      status: 'online',
      uptime: 691200,
      uptimeFormatted: '8 days',
      memory: 9437184,
      memoryFormatted: '9.0mb',
      description: 'Node.js server',
    },
  ];
}

