import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { exportConversation } from '../../api';
import './command-palette.css';

interface PaletteItem {
  id: string;
  label: string;
  section: 'Notebooks' | 'Documents' | 'Actions';
  /** Optional keyboard shortcut hint rendered on the right side of the row. */
  shortcut?: string;
  onSelect: () => void;
}

/**
 * Tokenized fuzzy-ish scorer. Splits the query on whitespace and requires
 * every token to be present in the label (case-insensitive). Rewards token
 * prefix matches and contiguous runs. `"note sum"` → matches "Summarize
 * this notebook" and "Notebook — Summary".
 */
function matchScore(query: string, label: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  const l = label.toLowerCase();
  const tokens = q.split(/\s+/);
  let score = 0;
  for (const t of tokens) {
    if (!l.includes(t)) return 0;
    // Prefix at the start of the label is the strongest signal.
    if (l.startsWith(t)) score += 3;
    // Prefix of any word inside the label is next.
    else if (new RegExp(`\\b${t}`).test(l)) score += 2;
    else score += 1;
  }
  return score;
}

export function CommandPalette({
  open,
  onClose,
  onZoteroImport,
}: {
  open: boolean;
  onClose: () => void;
  onZoteroImport?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const notebooks = useAppStore((s) => s.notebooks);
  const documents = useAppStore((s) => s.documents);
  const messages = useAppStore((s) => s.messages);
  const setActiveNotebookId = useAppStore((s) => s.setActiveNotebookId);
  const toggleSourcePanel = useAppStore((s) => s.toggleSourcePanel);
  const newChat = useAppStore((s) => s.newChat);
  const setPreviewDocument = useAppStore((s) => s.setPreviewDocument);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      // Minimal focus trap: keep Tab inside the palette container.
      if (e.key === 'Tab') {
        const root = containerRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'input, button, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  const allItems: PaletteItem[] = [
    ...notebooks.map((nb) => ({
      id: `nb-${nb.notebook_id}`,
      label: nb.title,
      section: 'Notebooks' as const,
      onSelect: () => {
        setActiveNotebookId(nb.notebook_id);
        onClose();
      },
    })),
    ...documents.map((doc) => ({
      id: `doc-${doc.source_path}`,
      label: doc.filename,
      section: 'Documents' as const,
      onSelect: () => {
        setPreviewDocument(doc);
        onClose();
      },
    })),
    {
      id: 'action-new-chat',
      label: 'New chat',
      section: 'Actions',
      shortcut: '⌘N',
      onSelect: () => {
        newChat();
        onClose();
      },
    },
    {
      id: 'action-toggle-sources',
      label: 'Toggle source panel',
      section: 'Actions',
      shortcut: '⌘/',
      onSelect: () => {
        toggleSourcePanel();
        onClose();
      },
    },
    {
      id: 'action-export',
      label: 'Export conversation',
      section: 'Actions',
      shortcut: '⌘⇧E',
      onSelect: () => {
        if (messages.length > 0) {
          exportConversation('Notebook LM Conversation', messages);
        }
        onClose();
      },
    },
    ...(onZoteroImport
      ? [
          {
            id: 'action-zotero',
            label: 'Import from Zotero',
            section: 'Actions' as const,
            onSelect: () => {
              onZoteroImport();
              onClose();
            },
          },
        ]
      : []),
  ];

  const filtered = query
    ? allItems
        .map((item) => ({ item, score: matchScore(query, item.label) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item)
    : allItems;

  const sections: Array<{ name: string; items: PaletteItem[] }> = [];
  for (const sectionName of ['Notebooks', 'Documents', 'Actions'] as const) {
    const items = filtered.filter((i) => i.section === sectionName);
    if (items.length > 0) {
      sections.push({ name: sectionName, items });
    }
  }

  const flatItems = sections.flatMap((s) => s.items);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        flatItems[selectedIndex].onSelect();
      }
    }
  };

  let itemIndex = 0;

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div
        ref={containerRef}
        className="palette-container"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="palette-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search notebooks, documents, actions..."
          aria-label="Command palette input"
        />
        <div className="palette-results">
          {sections.length === 0 && <div className="palette-empty">No results</div>}
          {sections.map((section) => (
            <div key={section.name} className="palette-section">
              <div className="palette-section-title">{section.name}</div>
              {section.items.map((item) => {
                const idx = itemIndex++;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`palette-item ${idx === selectedIndex ? 'selected' : ''}`}
                    onClick={item.onSelect}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className="palette-item-label">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="palette-item-shortcut">{item.shortcut}</kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
