'use client';

// Main dashboard page for security operations
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Map as MapIcon, Lock } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface DashboardStats {
  recentKnocks: number;
  bikeStatus: {
    bike: { timestamp: string } | null;
    user: { timestamp: string } | null;
    distance: number | null;
  } | null;
}

export default function Home() {
  const [stats, setStats] = useState<DashboardStats>({
    recentKnocks: 0,
    bikeStatus: null,
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

        setStats({
          recentKnocks: knocksData.totalItems || 0,
          bikeStatus: bikeData,
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
        </div>
      )}
    </div>
  );
}
