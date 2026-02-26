'use client';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface ChartData {
    timestamp: string;
    distance: number;
    presence: boolean;
    voltage: number;
    moving_energy: number; // New field
}

interface PresenceChartProps {
    data: ChartData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-gray-900 border border-cyan-500/50 p-3 rounded shadow-lg">
                <p className="text-gray-300 font-mono text-xs mb-1">
                    {format(new Date(label), 'HH:mm')}
                </p>
                <div className="flex flex-col gap-1">
                    <p className="text-cyan-400 font-bold font-mono">
                        Distance: {data.distance} cm
                    </p>
                    <p className="text-gold font-bold font-mono">
                        Energy: {data.moving_energy}%
                    </p>
                </div>
                <p className={`text-xs font-mono mt-2 ${data.distance > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                    {data.distance > 0 ? 'STATUS: ACTIVE' : 'STATUS: CLEAR'}
                </p>
                <p className="text-[10px] text-gray-500 font-mono mt-1">
                    Bat: {data.voltage.toFixed(2)}V
                </p>
            </div>
        );
    }
    return null;
};

export default function PresenceChart({ data }: PresenceChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 font-mono text-sm">
                No historical data available
            </div>
        );
    }

    return (
        <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => format(new Date(ts), 'HH:mm')}
                        stroke="#666"
                        tick={{ fill: '#888', fontSize: 12, fontFamily: 'monospace' }}
                    />
                    <YAxis
                        yAxisId="left"
                        stroke="#666"
                        tick={{ fill: '#888', fontSize: 12, fontFamily: 'monospace' }}
                        unit=" cm"
                        domain={[0, 700]}
                        allowDataOverflow={true}
                    />
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#888"
                        tick={{ fill: '#d4af37', fontSize: 12, fontFamily: 'monospace' }}
                        domain={[0, 100]}
                        unit="%"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="distance"
                        stroke="#06b6d4" // Cyan-500
                        strokeWidth={2}
                        dot={{ fill: '#06b6d4', r: 3 }}
                        activeDot={{ r: 6, fill: '#fff' }}
                    />
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="moving_energy"
                        stroke="#d4af37" // Gold
                        strokeWidth={2}
                        dot={{ fill: '#d4af37', r: 2 }}
                        activeDot={{ r: 4, fill: '#fff' }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
