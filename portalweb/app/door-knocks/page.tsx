'use client';

import { useState, useEffect } from 'react';
import { Lock, AlertTriangle, RefreshCw } from 'lucide-react';
import StatisticsCards from '@/components/StatisticsCards';
import DoorKnockTable from '@/components/DoorKnockTable';

interface DoorKnock {
  id: string;
  mac: string;
  knock_count: number;
  timestamp: string;
}

export default function DoorKnocksPage() {
  const [knocks, setKnocks] = useState<DoorKnock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ today: 0, thisWeek: 0, thisMonth: 0 });
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchKnocks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) {
        params.append('from', Math.floor(new Date(dateFrom).getTime() / 1000).toString());
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        params.append('to', Math.floor(toDate.getTime() / 1000).toString());
      }

      const response = await fetch(`/api/door-knocks?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch door knocks');
      const data = await response.json();
      setKnocks(data.items || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await fetch('/api/door-knocks/stats');
      if (!response.ok) throw new Error('Failed to fetch statistics');
      const data = await response.json();
      setStats({
        today: data.today || 0,
        thisWeek: data.thisWeek || 0,
        thisMonth: data.thisMonth || 0,
      });
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  };

  useEffect(() => {
    fetchKnocks();
    fetchStatistics();
  }, []);

  useEffect(() => {
    fetchKnocks();
    fetchStatistics();
  }, [dateFrom, dateTo]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchKnocks(), fetchStatistics()]);
    setRefreshing(false);
  };

  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div>
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white font-serif drop-shadow-lg flex items-center gap-3">
            <span className="text-blood text-4xl">»</span> Door Knock
          </h2>
          <p className="text-gray-500 font-mono text-sm mt-1 max-w-2xl">
            Monitor and analyze door knock events. All door knock events are logged and tracked.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-8 border-l-4 border-blood bg-gradient-to-r from-gray-900 to-black p-6 relative overflow-hidden shadow-2xl">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-blood" />
            <p className="text-blood font-mono text-sm">Error: {error}</p>
          </div>
        </div>
      )}

      <StatisticsCards
        today={stats.today}
        thisWeek={stats.thisWeek}
        thisMonth={stats.thisMonth}
      />

      {/* Filters */}
      <div className="bg-charcoal/50 border border-gray-800 p-6 mb-6 relative group">
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blood"></div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blood"></div>
        <h2 className="text-gold font-mono uppercase tracking-widest text-sm mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4" /> Filters
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase text-gray-500 mb-2">
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 bg-gray-900 text-gray-200 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blood focus:border-blood transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-gray-500 mb-2">
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 bg-gray-900 text-gray-200 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blood focus:border-blood transition-colors"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex-1 px-4 py-2 bg-transparent border border-gray-600 text-gray-400 font-mono text-xs hover:border-blood hover:text-blood transition-all uppercase flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleClearFilters}
              className="flex-1 px-4 py-2 bg-transparent border border-gray-600 text-gray-400 font-mono text-xs hover:border-white hover:text-white transition-all uppercase"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <DoorKnockTable knocks={knocks} loading={loading} />
    </div>
  );
}





