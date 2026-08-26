export interface Doubt {
  id: string;
  text: string;
  embedding: number[];
  timestamp: string;
  clusterId?: string;
  // EXPLICITLY NO student identity field visible outside the moderation layer
}

export interface DoubtCluster {
  id: string;
  representativeText: string;
  count: number;
  firstSeenAt: string;
  lastSpikeAt: string;
}

export interface SessionInfo {
  id: string;
  status: 'active' | 'ended';
  startedAt: string;
  teacherId: string;
}

export interface DeviceInfo {
  id: string;
  connectedAt: string;
  status: 'active' | 'blocked';
}
