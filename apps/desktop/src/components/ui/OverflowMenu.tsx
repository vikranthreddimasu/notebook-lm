import { useEffect, useRef, useState } from 'react';
import './overflow-menu.css';

interface MenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface OverflowMenuProps {
  items: MenuItem[];
}

export function OverflowMenu({ items }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  return (
    <div className="overflow-menu" ref={menuRef}>
      <button
        type="button"
        className="overflow-menu-trigger"
        onClick={() => setOpen(!open)}
        aria-label="More actions"
      >
        &middot;&middot;&middot;
      </button>
      {open && (
        <div className="overflow-menu-popover">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className="overflow-menu-item"
              disabled={item.disabled}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
