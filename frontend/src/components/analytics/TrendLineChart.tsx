import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface TrendLineChartProps {
  data: any[];
  xKey: string;
  lines: { key: string; color: string; name: string }[];
  height?: number;
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  data,
  xKey,
  lines,
  height = 300
}) => {
  if (!data || data.length === 0) {
    return (
      <div className={`w-full flex items-center justify-center bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-100 dark:border-navy-700`} style={{ height }}>
        <p className="text-slate-400 dark:text-navy-400 font-medium">No historical data available for this period.</p>
      </div>
    );
  }

  const formatDateTick = (tickStr: string) => {
    if (!tickStr) return '';
    try {
      if (tickStr.includes('-')) {
        const parts = tickStr.split('-');
        if (parts.length === 3) {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const mIdx = parseInt(parts[1], 10) - 1;
          return `${months[mIdx]} ${parseInt(parts[2], 10)}`;
        }
      }
    } catch {}
    return tickStr;
  };

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 15, right: lines.length > 1 ? 10 : 30, left: 0, bottom: 5 }}>
          <defs>
            {lines.map((line, idx) => (
              <linearGradient key={idx} id={`color-${line.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={line.color} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={line.color} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
          <XAxis 
            dataKey={xKey} 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
            tickFormatter={formatDateTick}
            dy={10}
            minTickGap={20}
          />
          <YAxis 
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
            domain={['auto', 'auto']}
            width={45}
            tickFormatter={(value) => value.toLocaleString()}
          />
          {lines.length > 1 && (
            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
              domain={['auto', 'auto']}
              width={45}
              tickFormatter={(value) => value.toLocaleString()}
            />
          )}
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: 'none',
              borderRadius: '12px',
              color: '#f8fafc',
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
              padding: '12px 16px',
              fontWeight: 600
            }}
            itemStyle={{ color: '#f8fafc', padding: '4px 0', fontSize: '13px' }}
            labelStyle={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}
            labelFormatter={formatDateTick}
            cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }} 
            iconType="circle"
            iconSize={8}
          />
          {lines.map((line, idx) => (
            <Area
              key={idx}
              yAxisId={idx === 0 ? "left" : "right"}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={3}
              fill={`url(#color-${line.key})`}
              dot={{ r: 0 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
              connectNulls={true}
              animationDuration={1500}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
