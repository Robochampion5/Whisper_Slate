import React from 'react';
import { ShieldAlert, Trash2 } from 'lucide-react';

interface DevicePanelProps {
  devices: {
    id: string;
    is_blocked: boolean;
    full_token: string;
  }[];
  onBlock: (id: string) => void;
  onKick: (id: string) => void;
}

export const DevicePanel: React.FC<DevicePanelProps> = ({ devices, onBlock, onKick }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-full flex flex-col">
      <div className="p-4 border-b border-slate-800 bg-slate-950">
        <h3 className="font-semibold text-slate-200 flex items-center gap-2">
          Connected Devices
          <span className="bg-slate-800 text-slate-300 text-xs py-0.5 px-2 rounded-full">
            {devices.length}
          </span>
        </h3>
        <p className="text-xs text-slate-500 mt-1">Identities are completely anonymized.</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {devices.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500">
            No devices connected yet.
          </div>
        ) : (
          <div className="space-y-1">
            {devices.map((d) => (
              <div 
                key={d.id}
                className={`p-3 rounded-lg flex items-center justify-between group transition-colors ${
                  d.is_blocked ? 'bg-rose-950/30 border border-rose-900/50' : 'hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${d.is_blocked ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  <span className={`font-mono text-sm ${d.is_blocked ? 'text-rose-300' : 'text-slate-300'}`}>
                    Device {d.id}
                  </span>
                </div>
                
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                  {!d.is_blocked && (
                    <button 
                      onClick={() => onBlock(d.id)}
                      title="Block device"
                      className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 rounded"
                    >
                      <ShieldAlert size={16} />
                    </button>
                  )}
                  <button 
                    onClick={() => onKick(d.id)}
                    title="Kick device"
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
