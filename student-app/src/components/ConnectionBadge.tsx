import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { pingServer } from '../services/api';

export default function ConnectionBadge() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const checkConnection = async () => {
      const ok = await pingServer();
      if (mounted) setIsConnected(ok);
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000); // Check every 5 seconds
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!isConnected) {
    return (
      <div className="fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-red-950/80 text-red-200 text-xs font-medium rounded-full border border-red-900/50 backdrop-blur-sm">
        <WifiOff className="w-3 h-3" />
        <span>Not connected</span>
      </div>
    );
  }

  return (
    <div className="fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-teal-950/80 text-teal-200 text-xs font-medium rounded-full border border-teal-900/50 backdrop-blur-sm">
      <Wifi className="w-3 h-3" />
      <span>Classroom Network</span>
    </div>
  );
}
