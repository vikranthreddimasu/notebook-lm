import { useEffect } from 'react';
import { useAppStore } from './store/app-store';
import { fetchConfig } from './api';
import { AppShell } from './components/layout/AppShell';

function App() {
  const status = useAppStore((s) => s.status);
  const setStatus = useAppStore((s) => s.setStatus);
  const setConfig = useAppStore((s) => s.setConfig);

  useEffect(() => {
    async function bootstrap() {
      try {
        if (window.notebookBridge) {
          await window.notebookBridge.ping();
        }
        const config = await fetchConfig();
        setConfig(config);
        setStatus('ready');
      } catch (err) {
        console.error('Bootstrap failed:', err);
        setStatus('error');
      }
    }
    bootstrap();
  }, [setStatus, setConfig]);

  if (status === 'checking') {
    return <div className="app-loading">Connecting to backend...</div>;
  }

  if (status === 'error') {
    return (
      <div className="app-error">
        Failed to connect to backend. Make sure it is running on http://127.0.0.1:8000
      </div>
    );
  }

  return <AppShell />;
}

export default App;
