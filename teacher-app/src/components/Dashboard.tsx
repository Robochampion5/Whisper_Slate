import React, { useCallback, useEffect, useRef, useState } from 'react';
import { InboxIcon, LayoutDashboard } from 'lucide-react';
import { SessionScreen } from './SessionScreen';
import { ClusterCard } from './ClusterCard';
import { DevicePanel } from './DevicePanel';
import { GlobalTimeline } from './GlobalTimeline';
import { ModerationQueue } from './ModerationQueue';
import { DashboardWebSocket } from '../services/ws';
import * as api from '../services/api';
import type { QueueDoubt } from '../services/api';

type Tab = 'clusters' | 'queue';

export const Dashboard: React.FC = () => {
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [clusters, setClusters] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [queue, setQueue] = useState<QueueDoubt[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('clusters');

  const wsRef = useRef<DashboardWebSocket | null>(null);

  // -------------------------------------------------------------------------
  // Fetch moderation queue
  // -------------------------------------------------------------------------
  const fetchQueue = useCallback(async (code: string) => {
    try {
      const q = await api.getModerationQueue(code);
      setQueue(q);
    } catch (e) {
      console.error('Failed to fetch moderation queue', e);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Session lifecycle
  // -------------------------------------------------------------------------
  const handleStart = async (topics: string[]) => {
    try {
      const code = await api.startSession(topics);
      setSessionCode(code);
      connectWs(code);
    } catch (e) {
      console.error('Failed to start session', e);
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
      setPendingCount(0);
      setQueue([]);
      setActiveTab('clusters');
      wsRef.current?.disconnect();
      wsRef.current = null;
    } catch (e) {
      console.error('Failed to stop session', e);
    }
  };

  // -------------------------------------------------------------------------
  // WebSocket
  // -------------------------------------------------------------------------
  const connectWs = (code: string) => {
    wsRef.current?.disconnect();

    // Initial fetch
    api.getClusters(code).then((data) => {
      setClusters(data.clusters);
      setTimeline(data.global_timeline);
      setDevices(data.devices);
      setPendingCount(data.pending_count ?? 0);
    });
    fetchQueue(code);

    const ws = new DashboardWebSocket('ws://localhost:8000/ws/dashboard', (data) => {
      if (data.type === 'CLUSTER_UPDATE' && data.sessionCode === code) {
        setClusters(data.clusters);
        setTimeline(data.global_timeline);
        setDevices(data.devices);
        const pc = data.pending_count ?? 0;
        setPendingCount(pc);
        // Auto-switch to the queue tab when new doubts arrive and teacher is on clusters
        if (pc > 0 && activeTab === 'clusters') {
          // Only nudge — don't forcibly switch mid-review
        }
        // Always keep the queue list fresh when a broadcast arrives
        fetchQueue(code);
      }
    });

    ws.connect();
    wsRef.current = ws;
  };

  useEffect(() => () => wsRef.current?.disconnect(), []);

  // -------------------------------------------------------------------------
  // After a review action, refresh queue + trigger recluster via WS
  // -------------------------------------------------------------------------
  const handleReviewed = useCallback(() => {
    if (sessionCode) fetchQueue(sessionCode);
  }, [sessionCode, fetchQueue]);

  // -------------------------------------------------------------------------
  // Device actions
  // -------------------------------------------------------------------------
  const handleBlock = async (id: string) => {
    try {
      await api.blockDevice(id);
      setDevices((prev) => prev.map((d) => d.id === id ? { ...d, is_blocked: true } : d));
    } catch (e) { console.error(e); }
  };

  const handleKick = async (id: string) => {
    try {
      await api.kickDevice(id);
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } catch (e) { console.error(e); }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
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
            <div className="col-span-12 lg:col-span-9 space-y-6">

              {/* Tab bar */}
              <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
                <TabButton
                  id="tab-clusters"
                  active={activeTab === 'clusters'}
                  onClick={() => setActiveTab('clusters')}
                  icon={<LayoutDashboard size={15} />}
                  label="What to Re-teach"
                  badge={clusters.reduce((a, c) => a + c.count, 0) || undefined}
                  badgeVariant="emerald"
                />
                <TabButton
                  id="tab-queue"
                  active={activeTab === 'queue'}
                  onClick={() => setActiveTab('queue')}
                  icon={<InboxIcon size={15} />}
                  label="Review Queue"
                  badge={pendingCount > 0 ? pendingCount : undefined}
                  badgeVariant="amber"
                />
              </div>

              {/* Clusters tab */}
              {activeTab === 'clusters' && (
                <div className="space-y-4">
                  {clusters.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-12 text-center text-slate-500">
                      No accepted doubts yet — accept some from the Review Queue to see clusters here.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {clusters.map((c, i) => (
                        <div key={c.id} className={i === 0 ? 'md:col-span-2' : ''}>
                          <ClusterCard cluster={c} isTop={i === 0} />
                        </div>
                      ))}
                    </div>
                  )}

                  {timeline.length > 0 && <GlobalTimeline data={timeline} />}
                </div>
              )}

              {/* Moderation queue tab */}
              {activeTab === 'queue' && (
                <ModerationQueue queue={queue} onReviewed={handleReviewed} />
              )}
            </div>

            {/* Side Panel */}
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

// ---------------------------------------------------------------------------
// Tab button sub-component
// ---------------------------------------------------------------------------

interface TabButtonProps {
  id: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeVariant?: 'emerald' | 'amber';
}

function TabButton({ id, active, onClick, icon, label, badge, badgeVariant = 'emerald' }: TabButtonProps) {
  const badgeColor =
    badgeVariant === 'amber'
      ? 'bg-amber-500/20 text-amber-400'
      : 'bg-emerald-500/20 text-emerald-400';

  return (
    <button
      id={id}
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-slate-800 text-slate-100 shadow-sm'
          : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badgeColor}`}>
          {badge}
        </span>
      )}
    </button>
  );
}
