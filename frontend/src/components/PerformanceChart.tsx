import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Users, Activity, BarChart2 } from 'lucide-react';
import api from '../services/api';

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface DataPoint {
  label: string;
  problemsSolved: number;
  activeStudents: number;
}

const PerformanceChart: React.FC = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>('monthly');
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/analytics/performance-chart`, {
          params: { timeframe }
        });
        if (isMounted) {
          setData(response.data.data || []);
        }
      } catch (error) {
        console.error('Error fetching performance chart data:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [timeframe]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-4 rounded-xl border border-white/20 shadow-xl bg-white/90 dark:bg-navy-950/90 backdrop-blur-md">
          <p className="font-bold text-slate-900 dark:text-white mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            {label}
          </p>
          <div className="space-y-2">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {entry.name}
                  </span>
                </div>
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {entry.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="stagger-3 relative overflow-hidden rounded-xl bg-white dark:bg-navy-950 p-6 shadow-sm border border-slate-200 dark:border-navy-700 mt-6">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <Activity className="w-4 h-4 text-brand-500" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
              Real-Time Performance Trajectory
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium pl-6">
            Institutional problem solving throughput & active participation
          </p>
        </div>

        {/* Timeframe Dropdown */}
        <div className="relative">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as Timeframe)}
            className="appearance-none bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 text-slate-700 dark:text-slate-300 py-2 pl-4 pr-10 rounded-xl text-xs font-bold tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-brand-500/50 cursor-pointer shadow-sm transition-all"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="h-[280px] w-full relative">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-navy-950/50 backdrop-blur-sm z-10 rounded-xl"
            >
              <div className="flex flex-col items-center space-y-3">
                <BarChart2 className="w-6 h-6 text-brand-500 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Aggregating Telemetry...
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="chart"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="h-full w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorProblems" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.15} />
                  <XAxis 
                    dataKey="label" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis 
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }}
                    dx={-10}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }}
                    dx={10}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="problemsSolved" 
                    name="Problems Solved"
                    stroke="#6366f1" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorProblems)" 
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }}
                  />
                  <Area 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="activeStudents" 
                    name="Active Participants"
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorStudents)" 
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
};

export { PerformanceChart };
export default PerformanceChart;
