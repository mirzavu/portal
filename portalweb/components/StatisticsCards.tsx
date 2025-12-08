'use client';

interface StatisticsCardsProps {
  today: number;
  thisWeek: number;
  thisMonth: number;
}

export default function StatisticsCards({ today, thisWeek, thisMonth }: StatisticsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-charcoal/50 border border-gray-800 p-6 relative group">
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blood"></div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blood"></div>
        <div className="text-xs text-gray-500 font-mono uppercase mb-1">Today</div>
        <div className="text-3xl font-bold text-blood font-mono">{today}</div>
      </div>
      <div className="bg-charcoal/50 border border-gray-800 p-6 relative group">
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-gold"></div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-gold"></div>
        <div className="text-xs text-gray-500 font-mono uppercase mb-1">This Week</div>
        <div className="text-3xl font-bold text-gold font-mono">{thisWeek}</div>
      </div>
      <div className="bg-charcoal/50 border border-gray-800 p-6 relative group">
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-gold"></div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-gold"></div>
        <div className="text-xs text-gray-500 font-mono uppercase mb-1">This Month</div>
        <div className="text-3xl font-bold text-gold font-mono">{thisMonth}</div>
      </div>
    </div>
  );
}






