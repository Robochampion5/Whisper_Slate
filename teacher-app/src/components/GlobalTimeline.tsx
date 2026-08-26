import React from 'react';
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import { format, parseISO } from 'date-fns';

interface GlobalTimelineProps {
  data: { time: string; count: number }[];
}

export const GlobalTimeline: React.FC<GlobalTimelineProps> = ({ data }) => {
  if (data.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-64 shadow-xl">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Classroom Confusion Timeline
      </h3>
      <div className="w-full h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis 
              dataKey="time" 
              tickFormatter={(val) => format(parseISO(val), 'HH:mm')} 
              stroke="#475569" 
              fontSize={12}
              tickMargin={10}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
              labelFormatter={(val) => format(parseISO(val as string), 'HH:mm')}
              cursor={{fill: '#1e293b'}}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
