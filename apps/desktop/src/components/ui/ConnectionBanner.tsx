import { useEffect, useRef, useState } from 'react';
import './connection-banner.css';

type ConnectionState = 'healthy' | 'backend-down' | 'ollama-down';

const BACKEND_HEALTHZ = 'http://127.0.0.1:8000/api/healthz';
const OLLAMA_VERSION = 'http://127.0.0.1:11434/api/version';

/**
 * Top-of-window banner that watches both the backend and Ollama. Raw errors
 * from a dead model used to land in the chat bubble with no recovery hint;
 * now the banner tells you the model is offline and how to recover.
 */
export function ConnectionBanner() {
  const [state, setState] = useState<ConnectionState>('healthy');
  const [showReconnected, setShowReconnected] = useState(false);
  const wasDown = useRef(false);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      // Backend is the hard blocker — if it's down, don't bother checking
      // Ollama because the user can't do anything either way.
      try {
        const backendRes = await fetch(BACKEND_HEALTHZ, { signal: AbortSignal.timeout(4000) });
        if (!backendRes.ok) throw new Error('backend-down');
      } catch {
        if (!mounted) return;
        wasDown.current = true;
        setState('backend-down');
        return;
      }

      // Ollama is a soft blocker — app still lists notebooks, but chat will fail.
      try {
        const ollamaRes = await fetch(OLLAMA_VERSION, { signal: AbortSignal.timeout(3000) });
        if (!ollamaRes.ok) throw new Error('ollama-down');
      } catch {
        if (!mounted) return;
        wasDown.current = true;
        setState('ollama-down');
        return;
      }

      if (!mounted) return;
      if (wasDown.current) {
        setShowReconnected(true);
        setTimeout(() => {
          if (mounted) setShowReconnected(false);
        }, 3000);
        wasDown.current = false;
      }
      setState('healthy');
    };

    // Run immediately on mount so the user sees status without waiting 30s.
    check();
    const interval = setInterval(check, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (state === 'healthy' && !showReconnected) return null;

  if (showReconnected) {
    return <div className="connection-banner connection-restored">Reconnected</div>;
  }

  if (state === 'backend-down') {
    return (
      <div className="connection-banner" role="alert">
        Backend isn't responding. Reconnecting&hellip;
      </div>
    );
  }

  return (
    <div className="connection-banner connection-banner-warn" role="alert">
      AI model (Ollama) isn't reachable. Start Ollama, then try your message again.
    </div>
  );
}
