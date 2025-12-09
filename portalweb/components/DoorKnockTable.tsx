'use client';

import { formatDate, formatRelativeTime } from '@/lib/utils';

interface DoorKnock {
  id: string;
  mac: string;
  knock_count: number;
  timestamp: string;
}

interface DoorKnockTableProps {
  knocks: DoorKnock[];
  loading?: boolean;
}

export default function DoorKnockTable({ knocks, loading }: DoorKnockTableProps) {
  if (loading) {
    return (
      <div className="bg-charcoal/50 border border-gray-800 p-6">
        <div className="text-center py-8 text-gray-400">Loading...</div>
      </div>
    );
  }

  if (knocks.length === 0) {
    return (
      <div className="bg-charcoal/50 border border-gray-800 p-6">
        <div className="text-center py-8 text-gray-400">
          No door knocks found
        </div>
      </div>
    );
  }

  return (
    <div className="bg-charcoal/50 border border-gray-800 p-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left p-3 text-gray-300 font-mono uppercase text-xs">Timestamp</th>
            <th className="text-left p-3 text-gray-300 font-mono uppercase text-xs">MAC Address</th>
            <th className="text-left p-3 text-gray-300 font-mono uppercase text-xs">Knock Count</th>
          </tr>
        </thead>
        <tbody>
          {knocks.map((knock) => (
            <tr
              key={knock.id}
              className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors"
            >
              <td className="p-3">
                <div className="text-gray-200 font-mono text-xs">
                  {formatRelativeTime(knock.timestamp)}
                </div>
                <div className="text-[10px] text-gray-500 font-mono">
                  {formatDate(knock.timestamp)}
                </div>
              </td>
              <td className="p-3 text-gray-400 font-mono text-xs">
                {knock.mac}
              </td>
              <td className="p-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded border border-blood/50 bg-blood/10 text-blood text-xs font-mono">
                  {knock.knock_count}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}








