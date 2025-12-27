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
                <p className="text-cyan-400 font-bold font-mono">
                    Distance: {data.distance} cm
                </p>
                <p className={`text-xs font-mono mt-1 ${data.distance > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                    {data.distance > 0 ? 'PRESENCE DETECTED' : 'CLEAR'}
                </p>
                <p className="text-xs text-gray-500 font-mono">
                    Volt: {data.voltage.toFixed(2)}V
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
                        stroke="#666"
                        tick={{ fill: '#888', fontSize: 12, fontFamily: 'monospace' }}
                        unit=" cm"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                        type="monotone"
                        dataKey="distance"
                        stroke="#06b6d4" // Cyan-500
                        strokeWidth={2}
                        dot={{ fill: '#06b6d4', r: 3 }}
                        activeDot={{ r: 6, fill: '#fff' }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
