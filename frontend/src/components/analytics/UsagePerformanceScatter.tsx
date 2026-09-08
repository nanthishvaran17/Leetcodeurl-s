import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis
} from 'recharts';

interface UsagePerformanceScatterProps {
  data: any[];
  xKey: string;
  yKey: string;
  nameKey: string;
  xLabel: string;
  yLabel: string;
  height?: number;
}

export const UsagePerformanceScatter: React.FC<UsagePerformanceScatterProps> = ({
  data,
  xKey,
  yKey,
  nameKey,
  xLabel,
  yLabel,
  height = 350
}) => {
  if (!data || data.length === 0) {
    return (
      <div className={`w-full flex items-center justify-center bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-100 dark:border-navy-700`} style={{ height }}>
        <p className="text-slate-400 dark:text-navy-400 font-medium">No sufficient data for correlation.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
          <XAxis 
            type="number" 
            dataKey={xKey} 
            name={xLabel} 
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={{ stroke: '#cbd5e1' }}
            tickLine={false}
          />
          <YAxis 
            type="number" 
            dataKey={yKey} 
            name={yLabel} 
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={{ stroke: '#cbd5e1' }}
            tickLine={false}
          />
          <ZAxis type="category" dataKey={nameKey} name="Student" />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: 'none',
              borderRadius: '8px',
              color: '#f8fafc',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}
            itemStyle={{ color: '#f8fafc' }}
          />
          <Scatter name="Students" data={data} fill="#8b5cf6" opacity={0.6} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
