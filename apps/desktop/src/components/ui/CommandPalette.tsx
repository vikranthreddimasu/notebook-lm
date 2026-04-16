import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { exportConversation } from '../../api';
import './command-palette.css';

interface PaletteItem {
  id: string;
  label: string;
  section: 'Notebooks' | 'Documents' | 'Actions';
  onSelect: () => void;
}

function matchScore(query: string, label: string): number {
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  if (l.startsWith(q)) return 2; // prefix match
  if (l.includes(q)) return 1;   // substring match
  return 0;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const notebooks = useAppStore((s) => s.notebooks);
  const documents = useAppStore((s) => s.documents);
  const messages = useAppStore((s) => s.messages);
  const setActiveNotebookId = useAppStore((s) => s.setActiveNotebookId);
  const toggleSourcePanel = useAppStore((s) => s.toggleSourcePanel);
  const clearMessages = useAppStore((s) => s.clearMessages);
  const setActiveConversationId = useAppStore((s) => s.setActiveConversationId);
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
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const allItems: PaletteItem[] = [
    ...notebooks.map((nb) => ({
      id: `nb-${nb.notebook_id}`,
      label: nb.title,
      section: 'Notebooks' as const,
      onSelect: () => { setActiveNotebookId(nb.notebook_id); onClose(); },
    })),
    ...documents.map((doc) => ({
      id: `doc-${doc.source_path}`,
      label: doc.filename,
      section: 'Documents' as const,
      onSelect: () => { setPreviewDocument(doc); onClose(); },
    })),
    {
      id: 'action-new-chat',
      label: 'New chat',
      section: 'Actions',
      onSelect: () => { clearMessages(); setActiveConversationId(null); onClose(); },
    },
    {
      id: 'action-toggle-sources',
      label: 'Toggle source panel',
      section: 'Actions',
      onSelect: () => { toggleSourcePanel(); onClose(); },
    },
    {
      id: 'action-export',
      label: 'Export conversation',
      section: 'Actions',
      onSelect: () => {
        if (messages.length > 0) {
          exportConversation('Notebook LM Conversation', messages);
        }
        onClose();
      },
    },
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

  const [selectedIndex, setSelectedIndex] = useState(0);
  const flatItems = sections.flatMap((s) => s.items);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

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
      <div className="palette-container" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search notebooks, documents, actions..."
        />
        <div className="palette-results">
          {sections.length === 0 && (
            <div className="palette-empty">No results</div>
          )}
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
                    {item.label}
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
