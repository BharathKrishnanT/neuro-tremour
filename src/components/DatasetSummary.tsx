import React from 'react';
import { SensorData } from '../lib/serial';
import { mlService } from '../lib/mlService';
import { Play, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DatasetSummaryProps {
  data: SensorData[];
  title?: string;
  onPlay: () => void;
  onClear: () => void;
}

export const DatasetSummary: React.FC<DatasetSummaryProps> = ({ data, title = "Dataset Analysis Summary", onPlay, onClear }) => {
  const features = mlService.extractFeatures(data, 'pen');
  
  // Calculate severity distribution (mocked for now based on segments)
  const segmentSize = 100;
  const segments = [];
  for (let i = 0; i < data.length; i += segmentSize) {
    const segment = data.slice(i, i + segmentSize);
    if (segment.length >= 10) {
      const f = mlService.extractFeatures(segment, 'pen');
      const severity = mlService.heuristicPrediction(f, 'pen');
      segments.push({
        index: i / segmentSize,
        severity,
        rms: f.rms
      });
    }
  }

  const severityCounts = [0, 0, 0, 0, 0];
  segments.forEach(s => severityCounts[Math.round(s.severity)]++);

  const chartData = severityCounts.map((count, i) => ({
    name: `Lvl ${i}`,
    count,
    color: i === 0 ? '#10b981' : i === 1 ? '#fbbf24' : i === 2 ? '#f59e0b' : i === 3 ? '#ef4444' : '#b91c1c'
  }));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <div className="flex gap-2">
          <button 
            onClick={onPlay}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Play className="w-4 h-4" />
            <span>{title.includes("Pause") ? "Resume Analysis" : "Play Session"}</span>
          </button>
          <button 
            onClick={onClear}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors text-sm font-medium border border-zinc-700"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear</span>
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Points</p>
            <p className="text-2xl font-bold text-white">{data.length}</p>
          </div>
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Avg RMS Tremor</p>
            <p className="text-2xl font-bold text-emerald-400">{features.rms.toFixed(3)}</p>
          </div>
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Avg Frequency</p>
            <p className="text-2xl font-bold text-blue-400">{features.frequency.toFixed(1)} Hz</p>
          </div>
        </div>

        <div className="md:col-span-2 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Severity Distribution (Segments)</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#e4e4e7' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
