import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  /** localStorage key — width persists across launches. */
  storageKey: string;
  /** Clamp range — prevents a panel from being dragged off-screen. */
  min: number;
  max: number;
  /** Drag direction: `from-left` means dragging left shrinks, drag right grows.
   *  `from-right` flips it for the right-side panel. */
  from: 'left' | 'right';
  /** Initial width if localStorage has nothing saved. */
  initial: number;
}

interface Result {
  width: number;
  setWidth: (w: number) => void;
  handleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    role: 'separator';
    tabIndex: 0;
    'aria-valuenow': number;
    'aria-valuemin': number;
    'aria-valuemax': number;
    'aria-orientation': 'vertical';
  };
}

export function usePaneResize({ storageKey, min, max, from, initial }: Options): Result {
  const [width, setWidthState] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    const parsed = saved ? parseInt(saved, 10) : NaN;
    return Number.isFinite(parsed) ? clamp(parsed, min, max) : initial;
  });

  const setWidth = useCallback(
    (w: number) => {
      const clamped = clamp(w, min, max);
      setWidthState(clamped);
      try {
        localStorage.setItem(storageKey, String(clamped));
      } catch {
        // localStorage may be disabled in some contexts (private window);
        // resize still works in-session, just won't persist.
      }
    },
    [storageKey, min, max],
  );

  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      const state = dragStartRef.current;
      if (!state) return;
      const delta = e.clientX - state.startX;
      const next = from === 'left' ? state.startWidth + delta : state.startWidth - delta;
      setWidth(next);
    },
    [from, setWidth],
  );

  const onMouseUp = useCallback(() => {
    dragStartRef.current = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onMouseMove]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragStartRef.current = { startX: e.clientX, startWidth: width };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      // Prevent text selection while dragging and show resize cursor everywhere.
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width, onMouseMove, onMouseUp],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Arrow-key resize keeps the handle keyboard-accessible.
      const step = e.shiftKey ? 40 : 10;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setWidth(width + (from === 'left' ? -step : step));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setWidth(width + (from === 'left' ? step : -step));
      }
    },
    [width, from, setWidth],
  );

  return {
    width,
    setWidth,
    handleProps: {
      onMouseDown,
      onKeyDown,
      role: 'separator',
      tabIndex: 0,
      'aria-valuenow': width,
      'aria-valuemin': min,
      'aria-valuemax': max,
      'aria-orientation': 'vertical',
    },
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
