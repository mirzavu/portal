import React from 'react';

interface StatusCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  critical?: boolean;
}

const StatusCard: React.FC<StatusCardProps> = ({ label, value, unit, icon, trend, critical }) => {
  return (
    <div className={`relative p-4 bg-gradient-to-br from-gray-900 to-black border ${critical ? 'border-blood animate-pulse' : 'border-gray-800'} shadow-lg backdrop-blur-md`}>
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold"></div>
      <div className="flex items-start justify-between mb-2">
        <div className="text-gray-500 text-xs font-mono uppercase tracking-widest">{label}</div>
        <div className={`${critical ? 'text-blood' : 'text-gold'}`}>{icon}</div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold font-mono ${critical ? 'text-red-500' : 'text-white'} drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]`}>
          {value}
        </span>
        {unit && <span className="text-xs text-gray-500 font-mono">{unit}</span>}
      </div>
      {trend && (
        <div className="mt-2 text-[10px] text-gray-600 font-mono flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${trend === 'down' ? 'bg-red-500' : 'bg-green-500'}`}></span>
          SYSTEM {trend === 'stable' ? 'NOMINAL' : trend.toUpperCase()}
        </div>
      )}
    </div>
  );
};

export default StatusCard;








