import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface DifficultyDistributionChartProps {
  data: { name: string; value: number }[];
  height?: number;
}

const COLORS = {
  Easy: '#10b981', // emerald-500
  Medium: '#f59e0b', // amber-500
  Hard: '#ef4444' // red-500
};

export const DifficultyDistributionChart: React.FC<DifficultyDistributionChartProps> = ({
  data,
  height = 300
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className={`w-full flex items-center justify-center bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-100 dark:border-navy-700`} style={{ height }}>
        <p className="text-slate-400 dark:text-navy-400 font-medium">No difficulty data available.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <PieChart margin={{ top: 0, right: 0, bottom: 10, left: 0 }}>
          <Pie
            data={data}
            cx="50%"
            cy="42%"
            innerRadius={52}
            outerRadius={75}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#94a3b8'} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: 'none',
              borderRadius: '8px',
              color: '#f8fafc',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}
            itemStyle={{ color: '#f8fafc' }}
          />
          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '10px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );

};
