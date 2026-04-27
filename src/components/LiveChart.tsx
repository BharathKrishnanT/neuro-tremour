import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { SensorData } from '../lib/serial';

interface LiveChartProps {
  data: SensorData[];
  dataKeys: { key: keyof SensorData; color: string; name: string }[];
  title: string;
  yDomain?: [number, number] | ['auto', 'auto'];
}

export const LiveChart: React.FC<LiveChartProps> = React.memo(({ data, dataKeys, title, yDomain = ['auto', 'auto'] }) => {
  return (
    <div className="w-full h-64 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col">
      <h3 className="text-zinc-400 text-sm font-medium mb-2 uppercase tracking-wider">{title}</h3>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis 
              dataKey="timestamp" 
              type="number" 
              domain={['dataMin', 'dataMax']} 
              tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString()}
              hide
            />
            <YAxis domain={yDomain} stroke="#666" fontSize={12} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
              labelFormatter={(label) => new Date(label).toLocaleTimeString()}
            />
            <Legend />
            {dataKeys.map((dk) => (
              <Line
                key={dk.key}
                type="monotone"
                dataKey={dk.key}
                stroke={dk.color}
                name={dk.name}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false} // Disable animation for performance in real-time
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
