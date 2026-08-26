import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Users, XCircle, Play } from 'lucide-react';

interface SessionScreenProps {
  sessionCode: string | null;
  onStart: () => void;
  onStop: () => void;
}

export const SessionScreen: React.FC<SessionScreenProps> = ({ sessionCode, onStart, onStop }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center justify-between shadow-xl">
      <div className="flex items-center gap-6">
        <div>
          <h2 className="text-xl font-bold text-slate-200 mb-1">Live Classroom Session</h2>
          <p className="text-slate-400 text-sm">Students can join using this code or QR.</p>
        </div>
        
        {sessionCode && (
          <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div className="text-4xl font-mono font-bold tracking-widest text-emerald-400">
              {sessionCode}
            </div>
            <div className="bg-white p-1 rounded">
              <QRCodeSVG value={`http://localhost:5173/?code=${sessionCode}`} size={64} />
            </div>
          </div>
        )}
      </div>

      <div>
        {!sessionCode ? (
          <button 
            onClick={onStart}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg shadow-emerald-500/20"
          >
            <Play size={20} />
            Start Session
          </button>
        ) : (
          <button 
            onClick={onStop}
            className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <XCircle size={20} />
            Stop Session
          </button>
        )}
      </div>
    </div>
  );
};
