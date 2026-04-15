import { useEffect, useRef, useState } from 'react';
import './connection-banner.css';

export function ConnectionBanner() {
  const [disconnected, setDisconnected] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const wasDisconnected = useRef(false);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        // Try the default backend URL; the app already resolved it during bootstrap
        const res = await fetch('http://127.0.0.1:8000/api/healthz', {
          signal: AbortSignal.timeout(5000),
        });
        if (!mounted) return;
        if (res.ok) {
          if (wasDisconnected.current) {
            setShowReconnected(true);
            setTimeout(() => { if (mounted) setShowReconnected(false); }, 3000);
            wasDisconnected.current = false;
          }
          setDisconnected(false);
        } else {
          wasDisconnected.current = true;
          setDisconnected(true);
        }
      } catch {
        if (!mounted) return;
        wasDisconnected.current = true;
        setDisconnected(true);
      }
    };

    const interval = setInterval(check, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  if (!disconnected && !showReconnected) return null;

  return (
    <div className={`connection-banner ${showReconnected ? 'connection-restored' : ''}`}>
      {showReconnected ? 'Reconnected' : 'Connection lost. Retrying...'}
    </div>
  );
}
