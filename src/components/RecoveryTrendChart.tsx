import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Session } from '../App';

interface RecoveryTrendChartProps {
  sessions: Session[];
}

export const RecoveryTrendChart: React.FC<RecoveryTrendChartProps> = ({ sessions }) => {
  // We want to show the trend from oldest to newest
  const chartData = [...sessions].reverse().map((session, index) => ({
    name: `S-${index + 1}`,
    rms: session.rms,
    frequency: session.frequency,
    timestamp: new Date(session.timestamp).toLocaleDateString(),
    fullDate: new Date(session.timestamp).toLocaleString()
  }));

  if (sessions.length < 2) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 h-64 flex flex-col items-center justify-center text-center">
        <p className="text-zinc-500 text-sm mb-2">Not enough data to show recovery trend.</p>
        <p className="text-zinc-600 text-xs">Record at least 2 sessions to see your progress.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Recovery Progress</h3>
          <p className="text-xs text-zinc-500">Tremor amplitude (RMS) over treatment sessions</p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorRms" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke="#6b7280" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
              dy={10}
            />
            <YAxis 
              stroke="#6b7280" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(val) => val.toFixed(2)}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }}
              itemStyle={{ color: '#e4e4e7' }}
              labelStyle={{ color: '#6b7280', marginBottom: '4px' }}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.fullDate;
                }
                return label;
              }}
            />
            <Area 
              type="monotone" 
              dataKey="rms" 
              stroke="#10b981" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorRms)" 
              name="Tremor Amplitude"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
