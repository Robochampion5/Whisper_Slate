import React, { useEffect, useState, useRef } from 'react';
import { SessionScreen } from './SessionScreen';
import { ClusterCard } from './ClusterCard';
import { DevicePanel } from './DevicePanel';
import { GlobalTimeline } from './GlobalTimeline';
import { DashboardWebSocket } from '../services/ws';
import * as api from '../services/api';

export const Dashboard: React.FC = () => {
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [clusters, setClusters] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  
  const wsRef = useRef<DashboardWebSocket | null>(null);

  const handleStart = async () => {
    try {
      const code = await api.startSession();
      setSessionCode(code);
      connectWs(code);
    } catch (e) {
      console.error("Failed to start session", e);
    }
  };

  const handleStop = async () => {
    if (!sessionCode) return;
    try {
      await api.stopSession(sessionCode);
      setSessionCode(null);
      setClusters([]);
      setTimeline([]);
      setDevices([]);
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    } catch (e) {
      console.error("Failed to stop session", e);
    }
  };

  const connectWs = (code: string) => {
    if (wsRef.current) wsRef.current.disconnect();
    
    // Initial fetch to get state immediately
    api.getClusters(code).then(data => {
      setClusters(data.clusters);
      setTimeline(data.global_timeline);
      setDevices(data.devices);
    });

    const ws = new DashboardWebSocket(`ws://localhost:8000/ws/dashboard`, (data) => {
      if (data.type === 'CLUSTER_UPDATE' && data.sessionCode === code) {
        setClusters(data.clusters);
        setTimeline(data.global_timeline);
        setDevices(data.devices);
      }
    });
    
    ws.connect();
    wsRef.current = ws;
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.disconnect();
    };
  }, []);

  const handleBlock = async (id: string) => {
    try {
      await api.blockDevice(id);
      // Optimistic update
      setDevices(prev => prev.map(d => d.id === id ? {...d, is_blocked: true} : d));
    } catch (e) {
      console.error(e);
    }
  };

  const handleKick = async (id: string) => {
    try {
      await api.kickDevice(id);
      // Optimistic update
      setDevices(prev => prev.filter(d => d.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header / Session Control */}
        <SessionScreen 
          sessionCode={sessionCode} 
          onStart={handleStart} 
          onStop={handleStop} 
        />

        {sessionCode && (
          <div className="grid grid-cols-12 gap-8">
            {/* Main Content Area */}
            <div className="col-span-12 lg:col-span-9 space-y-8">
              
              {/* Clusters Grid */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-3">
                  Live Confusions
                  {clusters.length > 0 && (
                    <span className="bg-emerald-500/20 text-emerald-400 text-sm py-1 px-3 rounded-full">
                      {clusters.reduce((acc, c) => acc + c.count, 0)} pending doubts
                    </span>
                  )}
                </h3>
                
                {clusters.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-12 text-center text-slate-500">
                    Listening for student doubts...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Render top cluster full width if there's an odd number, or just as first item */}
                    {clusters.map((c, i) => (
                      <div key={c.id} className={i === 0 ? 'md:col-span-2' : ''}>
                        <ClusterCard cluster={c} isTop={i === 0} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Global Timeline */}
              {timeline.length > 0 && (
                <GlobalTimeline data={timeline} />
              )}
            </div>

            {/* Side Panel Area */}
            <div className="col-span-12 lg:col-span-3">
              <div className="sticky top-8 h-[calc(100vh-8rem)]">
                <DevicePanel 
                  devices={devices} 
                  onBlock={handleBlock} 
                  onKick={handleKick} 
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
