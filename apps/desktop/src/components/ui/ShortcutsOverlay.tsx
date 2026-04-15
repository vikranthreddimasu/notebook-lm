import { useEffect, useState } from 'react';
import './shortcuts.css';

const SHORTCUTS = [
  { keys: ['Cmd', 'K'], action: 'Command palette (coming soon)' },
  { keys: ['Cmd', '/'], action: 'Toggle source panel' },
  { keys: ['Cmd', 'Shift', 'E'], action: 'Export conversation' },
  { keys: ['Enter'], action: 'Send message' },
  { keys: ['Shift', 'Enter'], action: 'New line in message' },
  { keys: ['?'], action: 'Show this help' },
  { keys: ['Esc'], action: 'Close overlay' },
];

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === '?' && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return null;

  return (
    <div className="shortcuts-overlay" onClick={() => setOpen(false)}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h3>Keyboard Shortcuts</h3>
          <button type="button" className="shortcuts-close" onClick={() => setOpen(false)}>
            &times;
          </button>
        </div>
        <div className="shortcuts-list">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="shortcut-row">
              <div className="shortcut-keys">
                {s.keys.map((k, j) => (
                  <kbd key={j} className="shortcut-key">{k}</kbd>
                ))}
              </div>
              <span className="shortcut-action">{s.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
