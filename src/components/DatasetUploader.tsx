import React, { useRef } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { SensorData } from '../lib/serial';

interface DatasetUploaderProps {
  onDataLoaded: (data: SensorData[]) => void;
  onError: (message: string) => void;
}

export const DatasetUploader: React.FC<DatasetUploaderProps> = ({ onDataLoaded, onError }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            onDataLoaded(parsed.map(d => ({
              timestamp: d.timestamp || Date.now(),
              ax: Number(d.ax || 0),
              ay: Number(d.ay || 0),
              az: Number(d.az || 0),
              gx: Number(d.gx || 0),
              gy: Number(d.gy || 0),
              gz: Number(d.gz || 0),
              mx: Number(d.mx || 0),
              my: Number(d.my || 0),
              mz: Number(d.mz || 0),
              fsr: Number(d.fsr || 0)
            })));
          } else {
            throw new Error("JSON must be an array of sensor data points.");
          }
        } else if (file.name.endsWith('.csv')) {
          const lines = content.split('\n');
          const data: SensorData[] = [];
          
          // Skip header if it exists
          const startIdx = lines[0].toLowerCase().includes('ax') ? 1 : 0;
          
          for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const parts = line.split(',');
            if (parts.length >= 7) {
              data.push({
                timestamp: parts.length > 9 ? Number(parts[9]) : Date.now() + i * 50,
                ax: Number(parts[0]),
                ay: Number(parts[1]),
                az: Number(parts[2]),
                gx: Number(parts[3]),
                gy: Number(parts[4]),
                gz: Number(parts[5]),
                mx: parts.length > 7 ? Number(parts[6]) : 0,
                my: parts.length > 8 ? Number(parts[7]) : 0,
                mz: parts.length > 9 ? Number(parts[8]) : 0,
                fsr: parts.length > 10 ? Number(parts[10]) : Number(parts[6] || 0), // Fallback for old 7-col format
                phase: 0,
                amplitude: 0
              });
            }
          }
          
          if (data.length === 0) throw new Error("No valid data found in CSV.");
          onDataLoaded(data);
        } else {
          throw new Error("Unsupported file format. Please use .csv or .json");
        }
      } catch (err: any) {
        onError(err.message || "Failed to parse file.");
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".csv,.json"
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg transition-colors text-sm font-medium"
        title="Upload recorded sensor data (.csv, .json)"
      >
        <Upload className="w-4 h-4 text-emerald-400" />
        <span className="hidden md:inline">Load Dataset</span>
      </button>
    </div>
  );
};
