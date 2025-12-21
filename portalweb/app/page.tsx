'use client';

// Main dashboard page for security operations
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Map as MapIcon, Lock, User, Server } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface DashboardStats {
  recentKnocks: number;
  bikeStatus: {
    bike: { timestamp: string } | null;
    user: { timestamp: string } | null;
    distance: number | null;
  } | null;
  presenceData: {
    presence: boolean;
    distance: number;
    voltage: number;
    battery_percent: number;
    timestamp: string;
  } | null;
  pm2Status: {
    processes: Array<{
      id: number;
      name: string;
      status: string;
      uptimeFormatted: string;
      memoryFormatted: string;
      restarts?: number;
      description?: string;
    }>;
    total: number;
    online: number;
    error?: string;
  } | null;
}

export default function Home() {
  const [stats, setStats] = useState<DashboardStats>({
    recentKnocks: 0,
    bikeStatus: null,
    presenceData: null,
    pm2Status: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch recent knocks count (last 24 hours)
        const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8095';
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const knocksResponse = await fetch(
          `${pbUrl}/api/collections/door_knocks/records?filter=timestamp >= "${yesterday}"&perPage=1`
        );
        const knocksData = await knocksResponse.json();

        // Fetch bike status
        const bikeResponse = await fetch('/api/bike/status');
        const bikeData = await bikeResponse.json();

        // Fetch presence data
        const presenceResponse = await fetch('/api/presence/latest');
        const presenceData = await presenceResponse.json();

        // Fetch PM2 status
        const pm2Response = await fetch('/api/pm2/status');
        const pm2Data = await pm2Response.json();

        setStats({
          recentKnocks: knocksData.totalItems || 0,
          bikeStatus: bikeData,
          presenceData: presenceData.presence !== null ? presenceData : null,
          pm2Status: pm2Data,
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 8000); // 8 seconds for faster updates
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white font-serif drop-shadow-lg flex items-center gap-3">
            <span className="text-blood text-4xl">»</span> Mainframe Dashboard
          </h2>
          <p className="text-gray-500 font-mono text-sm mt-1 max-w-2xl">
            Central command center for security operations and asset tracking.
            All systems operational.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blood shadow-[0_0_20px_rgba(138,3,3,0.5)]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Door Knocks Card */}
          <Link
            href="/door-knocks"
            className="group relative bg-charcoal/50 border border-gray-800 p-8 hover:border-blood transition-all duration-300"
          >
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blood"></div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blood"></div>
            <div className="flex items-start justify-between mb-6">
              <div className="p-3 bg-gradient-to-br from-red-500 to-red-700 rounded-xl shadow-[0_0_15px_rgba(255,0,0,0.5)]">
                <Lock className="w-8 h-8 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-4 text-gray-200 font-serif">
              Door Knock
            </h2>
            <div className="text-5xl font-bold text-blood mb-3 font-mono">
              {stats.recentKnocks}
            </div>
            <div className="text-sm text-gray-400 mb-4 font-mono">
              Activity in the last 24 hours
            </div>
            <div className="flex items-center text-gold text-sm font-semibold group-hover:translate-x-1 transition-transform font-mono uppercase">
              <span>View details</span>
              <span className="ml-2">→</span>
            </div>
          </Link>

          {/* Bike GPS Card */}
          <Link
            href="/bike"
            className="group relative bg-charcoal/50 border border-gray-800 p-8 hover:border-gold transition-all duration-300"
          >
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-gold"></div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-gold"></div>
            <div className="flex items-start justify-between mb-6">
              <div className="p-3 bg-gradient-to-br from-gold to-yellow-900 rounded-xl shadow-[0_0_15px_rgba(212,175,55,0.5)]">
                <MapIcon className="w-8 h-8 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-4 text-gray-200 font-serif">
              Asset Tracker
            </h2>
            {stats.bikeStatus?.bike ? (
              <>
                {stats.bikeStatus.distance !== null && (
                  <>
                    <div className="text-5xl font-bold text-gold mb-3 font-mono">
                      {stats.bikeStatus.distance < 1000
                        ? `${Math.round(stats.bikeStatus.distance)}m`
                        : `${(stats.bikeStatus.distance / 1000).toFixed(2)}km`}
                    </div>
                    <div className="text-sm text-gray-400 mb-2 font-mono">
                      Distance from home
                    </div>
                  </>
                )}
                <div className="text-xs text-gray-500 mb-4 font-mono">
                  Updated {formatRelativeTime(stats.bikeStatus.bike.timestamp)}
                </div>
                <div className="flex items-center text-gold text-sm font-semibold group-hover:translate-x-1 transition-transform font-mono uppercase">
                  <span>View tracking</span>
                  <span className="ml-2">→</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-gray-400 mb-4 font-mono">
                  No location data available
                </div>
                <div className="flex items-center text-gold text-sm font-semibold group-hover:translate-x-1 transition-transform font-mono uppercase">
                  <span>Setup tracking</span>
                  <span className="ml-2">→</span>
                </div>
              </>
            )}
          </Link>

          {/* Human Presence Sensor Card */}
          <div className="group relative bg-charcoal/50 border border-gray-800 p-8 hover:border-cyan-500 transition-all duration-300">
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-500"></div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-500"></div>
            <div className="flex items-start justify-between mb-6">
              <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                <User className="w-8 h-8 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-4 text-gray-200 font-serif">
              Human Presence
            </h2>
            {stats.presenceData ? (
              <>
                <div className="text-3xl font-bold mb-3 font-mono">
                  <span className={stats.presenceData.presence ? 'text-cyan-400' : 'text-gray-500'}>
                    {stats.presenceData.presence ? 'DETECTED' : 'ROOM CLEAR'}
                  </span>
                </div>
                {stats.presenceData.presence && stats.presenceData.distance > 0 ? (
                  <div className="text-2xl font-bold text-cyan-400 mb-2 font-mono">
                    {stats.presenceData.distance < 100
                      ? `${stats.presenceData.distance} cm`
                      : `${(stats.presenceData.distance / 100).toFixed(1)} m`}
                  </div>
                ) : (
                  <div className="text-lg text-gray-400 mb-2 font-mono">
                    Room Clear
                  </div>
                )}
                <div className="text-sm text-gray-400 mb-2 font-mono">
                  Battery: {stats.presenceData.battery_percent}% ({stats.presenceData.voltage?.toFixed(2) || 'N/A'}V)
                </div>
                {stats.presenceData.timestamp && (
                  <div className="text-xs text-gray-500 mb-4 font-mono">
                    Updated {formatRelativeTime(stats.presenceData.timestamp)}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-gray-400 mb-4 font-mono">
                  No data available
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PM2 Processes Section */}
      <div className="mt-12">
        <div className="mb-6 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.5)]">
            <Server className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white font-serif">
            PM2 Processes Summary
          </h2>
          {stats.pm2Status && (
            <span className="text-sm text-gray-400 font-mono">
              ({stats.pm2Status.online}/{stats.pm2Status.total} online)
            </span>
          )}
        </div>

        {stats.pm2Status?.error && (
          <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
            <p className="text-yellow-400 text-sm font-mono">{stats.pm2Status.error}</p>
          </div>
        )}

        {stats.pm2Status?.processes && stats.pm2Status.processes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.pm2Status.processes.map((proc) => (
              <div
                key={proc.id}
                className={`group relative bg-charcoal/50 border p-6 transition-all duration-300 ${
                  proc.status === 'online'
                    ? 'border-green-500/50 hover:border-green-500'
                    : 'border-red-500/50 hover:border-red-500'
                }`}
              >
                <div className={`absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 ${
                  proc.status === 'online' ? 'border-green-500' : 'border-red-500'
                }`}></div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 ${
                  proc.status === 'online' ? 'border-green-500' : 'border-red-500'
                }`}></div>
                
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white font-serif mb-1">
                      {proc.name}
                    </h3>
                    <p className="text-xs text-gray-400 font-mono">ID: {proc.id}</p>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-mono font-semibold ${
                    proc.status === 'online'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                      : 'bg-red-500/20 text-red-400 border border-red-500/50'
                  }`}>
                    {proc.status.toUpperCase()}
                  </div>
                </div>

                {proc.description && (
                  <p className="text-sm text-gray-400 mb-4 font-mono">
                    {proc.description}
                  </p>
                )}

                <div className="space-y-2 text-sm font-mono">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Uptime:</span>
                    <span className="text-gray-300">{proc.uptimeFormatted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Memory:</span>
                    <span className="text-gray-300">{proc.memoryFormatted}</span>
                  </div>
                  {proc.restarts !== undefined && proc.restarts > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Restarts:</span>
                      <span className="text-yellow-400">{proc.restarts}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-charcoal/50 border border-gray-800 p-8 text-center">
            <p className="text-gray-400 font-mono">Loading PM2 processes...</p>
          </div>
        )}
      </div>
    </div>
  );
}
