import React from 'react';

interface SkillData {
  topic: string;
  score: number; // 0 to 100
}

interface SkillRadarChartProps {
  skills?: SkillData[];
  totalSolved?: number;
}

export const SkillRadarChart: React.FC<SkillRadarChartProps> = ({ skills, totalSolved = 0 }) => {
  // Default dynamic calculation based on total solved
  const factor = Math.min(totalSolved / 200, 1);
  const defaultSkills: SkillData[] = [
    { topic: 'Arrays', score: Math.min(Math.round(85 * factor + 15), 98) },
    { topic: 'Strings', score: Math.min(Math.round(75 * factor + 10), 92) },
    { topic: 'DP', score: Math.min(Math.round(45 * factor + 5), 88) },
    { topic: 'Trees & Graphs', score: Math.min(Math.round(60 * factor + 10), 90) },
    { topic: 'Greedy', score: Math.min(Math.round(70 * factor + 8), 85) },
    { topic: 'Binary Search', score: Math.min(Math.round(65 * factor + 12), 94) },
  ];

  const data = skills && skills.length > 0 ? skills : defaultSkills;

  const size = 280;
  const center = size / 2;
  const radius = center - 40;
  const totalAxes = data.length;

  const getCoordinates = (index: number, score: number) => {
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const r = (score / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Polygon points
  const points = data.map((d, i) => {
    const { x, y } = getCoordinates(i, d.score);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="glass-card p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl flex flex-col items-center space-y-4">
      <div className="text-center">
        <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase tracking-wider flex items-center justify-center space-x-2">
          <span>DSA Skill Radar</span>
        </h3>
        <p className="text-[11px] text-gray-500">Algorithmic Topic Proficiency Breakdown</p>
      </div>

      <div className="relative w-[280px] h-[280px]">
        <svg width={size} height={size} className="overflow-visible">
          {/* Background Concentric Circles */}
          {[0.2, 0.4, 0.6, 0.8, 1].map((level, idx) => (
            <polygon
              key={idx}
              points={data.map((_, i) => {
                const { x, y } = getCoordinates(i, level * 100);
                return `${x},${y}`;
              }).join(' ')}
              className="fill-none stroke-gray-200 dark:stroke-gray-800/80 stroke-1"
              strokeDasharray={level === 1 ? "none" : "2 2"}
            />
          ))}

          {/* Axes */}
          {data.map((d, i) => {
            const { x, y } = getCoordinates(i, 100);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                className="stroke-gray-200 dark:stroke-gray-800 stroke-1"
              />
            );
          })}

          {/* Polygon Fill */}
          <polygon
            points={points}
            className="fill-brand-500/25 dark:fill-emerald-500/30 stroke-brand-500 dark:stroke-emerald-400 stroke-2 transition-all duration-500"
          />

          {/* Vertex Points & Labels */}
          {data.map((d, i) => {
            const { x, y } = getCoordinates(i, d.score);
            const labelPos = getCoordinates(i, 120);

            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  className="fill-brand-600 dark:fill-emerald-400 stroke-white dark:stroke-navy-950 stroke-2"
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[10px] font-bold fill-gray-700 dark:fill-gray-300 uppercase tracking-tighter"
                >
                  {d.topic} ({d.score}%)
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
