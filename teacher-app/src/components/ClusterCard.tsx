import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { format } from 'date-fns';

interface ClusterCardProps {
  cluster: {
    id: number;
    representative_text: string;
    count: number;
    score: number;
    spike_history: { timestamp: string; count: number }[];
    last_updated_at: string;
  };
  isTop: boolean;
}

export const ClusterCard: React.FC<ClusterCardProps> = ({ cluster, isTop }) => {
  // Format data for Recharts
  const chartData = cluster.spike_history.map((d, i) => ({
    name: i,
    count: d.count
  }));

  return (
    <div 
      className={`relative rounded-xl p-6 transition-all ${
        isTop 
          ? 'bg-gradient-to-br from-emerald-900/40 to-slate-900 border-2 border-emerald-500/50 shadow-lg shadow-emerald-900/20' 
          : 'bg-slate-900 border border-slate-800'
      }`}
    >
      {isTop && (
        <div className="absolute -top-3 -right-3 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
          Highest Signal
        </div>
      )}
      
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <p className={`font-medium ${isTop ? 'text-2xl text-emerald-50' : 'text-lg text-slate-200'}`}>
            "{cluster.representative_text}"
          </p>
          <div className="mt-2 text-sm text-slate-400">
            Last seen {format(new Date(cluster.last_updated_at), 'HH:mm:ss')}
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          <div className={`text-4xl font-black ${isTop ? 'text-emerald-400' : 'text-slate-400'}`}>
            {cluster.count}
          </div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">
            Students
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="mt-6 h-12 w-full opacity-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <YAxis hide domain={['dataMin', 'dataMax + 2']} />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke={isTop ? '#10b981' : '#64748b'} 
                strokeWidth={2} 
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
