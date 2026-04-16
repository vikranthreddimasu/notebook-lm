import './keyboard-shortcuts.css';

const SHORTCUTS = [
  { keys: '⌘ K', label: 'Command palette' },
  { keys: '⌘ N', label: 'New chat' },
  { keys: '⌘ /', label: 'Toggle source panel' },
  { keys: '⌘ ⇧ E', label: 'Export conversation' },
  { keys: '?', label: 'Keyboard shortcuts' },
  { keys: 'Esc', label: 'Close overlay' },
];

export function KeyboardShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="shortcuts-backdrop" onClick={onClose}>
      <div className="shortcuts-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="shortcuts-title">Keyboard Shortcuts</h3>
        <div className="shortcuts-list">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="shortcuts-row">
              <kbd className="shortcuts-keys">{s.keys}</kbd>
              <span className="shortcuts-label">{s.label}</span>
            </div>
          ))}
        </div>
        <p className="shortcuts-hint">Press Esc to close</p>
      </div>
    </div>
  );
}
