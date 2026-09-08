import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

interface RankingHorizontalBarProps {
  data: any[];
  yKey: string;
  xKey: string;
  color?: string;
  height?: number;
}

export const RankingHorizontalBar: React.FC<RankingHorizontalBarProps> = ({
  data,
  yKey,
  xKey,
  color = '#3b82f6',
  height = 350
}) => {
  if (!data || data.length === 0) {
    return (
      <div className={`w-full flex items-center justify-center bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-100 dark:border-navy-700`} style={{ height }}>
        <p className="text-slate-400 dark:text-navy-400 font-medium">No ranking data available.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart 
          data={data} 
          layout="vertical"
          margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#334155" opacity={0.2} />
          <XAxis 
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
          />
          <YAxis 
            type="category"
            dataKey={yKey}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
            width={100}
          />
          <Tooltip 
            cursor={{ fill: '#334155', opacity: 0.1 }}
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: 'none',
              borderRadius: '8px',
              color: '#f8fafc',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}
            itemStyle={{ color: '#f8fafc' }}
          />
          <Bar
            dataKey={xKey}
            fill={color}
            radius={[0, 4, 4, 0]}
            barSize={20}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index < 3 ? '#10b981' : color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
