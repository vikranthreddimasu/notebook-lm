import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { useNotebooks } from '../../hooks/useNotebooks';
import { uploadDocument, exportConversation } from '../../api';
import { Sidebar } from './Sidebar';
import { SourcePanel } from './SourcePanel';
import { ChatView } from '../chat/ChatView';
import { getDocumentPreviewUrl } from '../../api';
import DocumentPreview from '../../DocumentPreview';
import { ToastContainer, showToast } from '../ui/Toast';
import { DragOverlay } from '../ui/DragOverlay';
import { ConnectionBanner } from '../ui/ConnectionBanner';
import { SetupWizard } from '../ui/SetupWizard';
import { CommandPalette } from '../ui/CommandPalette';
import { KeyboardShortcutsOverlay } from '../ui/KeyboardShortcuts';
import './layout.css';

function isWizardComplete(): boolean {
  return localStorage.getItem('notebook-lm-wizard-complete') === 'true';
}

export function AppShell() {
  const previewDocument = useAppStore((s) => s.previewDocument);
  const setPreviewDocument = useAppStore((s) => s.setPreviewDocument);
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);
  const status = useAppStore((s) => s.status);

  const { notebooks, refresh: refreshNotebooks } = useNotebooks();

  const [showWizard, setShowWizard] = useState(false);
  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState<string | null>(null);
  const [pendingSuggest, setPendingSuggest] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K — command palette
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      // Cmd+/ — toggle source panel
      if (e.metaKey && e.key === '/') {
        e.preventDefault();
        useAppStore.getState().toggleSourcePanel();
        return;
      }
      // Cmd+Shift+E — export conversation
      if (e.metaKey && e.shiftKey && e.key === 'e') {
        e.preventDefault();
        const msgs = useAppStore.getState().messages;
        if (msgs.length > 0) {
          exportConversation('Notebook LM Conversation', msgs);
        }
        return;
      }
      // Cmd+N — new chat
      if (e.metaKey && e.key === 'n') {
        e.preventDefault();
        const s = useAppStore.getState();
        s.clearMessages();
        s.setActiveConversationId(null);
        return;
      }
      // ? — keyboard shortcuts (only when not typing in an input)
      if (e.key === '?' && !paletteOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          setShortcutsOpen((v) => !v);
          return;
        }
      }
      // Escape — close overlays
      if (e.key === 'Escape') {
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
        if (paletteOpen) { setPaletteOpen(false); return; }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [paletteOpen, shortcutsOpen]);

  // Check wizard on mount
  useEffect(() => {
    if (isWizardComplete()) return;

    async function checkOllama() {
      try {
        const res = await fetch('http://127.0.0.1:11434/api/version', { signal: AbortSignal.timeout(2000) });
        const tagsRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) });
        if (res.ok && tagsRes.ok) {
          const data = await tagsRes.json();
          if (data.models?.length > 0) {
            localStorage.setItem('notebook-lm-wizard-complete', 'true');
            return;
          }
        }
      } catch {
        // Can't reach Ollama
      }
      setShowWizard(true);
    }

    checkOllama();
  }, []);

  const handleWizardComplete = useCallback(() => {
    setShowWizard(false);
    refreshNotebooks();
    const store = useAppStore.getState();
    if (store.activeNotebookId) {
      setPendingSuggest('Summarize this document');
    }
  }, [refreshNotebooks]);

  useEffect(() => {
    if (previewDocument && activeNotebookId) {
      getDocumentPreviewUrl(activeNotebookId, previewDocument.source_path).then(
        setResolvedPreviewUrl,
      );
    } else {
      setResolvedPreviewUrl(null);
    }
  }, [previewDocument, activeNotebookId]);

  const activeNotebook = notebooks.find((nb) => nb.notebook_id === activeNotebookId);

  const handleGlobalDrop = useCallback(async (files: FileList) => {
    try {
      for (const file of Array.from(files)) {
        showToast(`Processing ${file.name}...`);
        const result = await uploadDocument(file, activeNotebookId || undefined);
        if (!activeNotebookId) {
          useAppStore.getState().setActiveNotebookId(result.notebook_id);
        }
        showToast(`${file.name} indexed successfully`, 'success');
      }
      await refreshNotebooks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    }
  }, [activeNotebookId, refreshNotebooks]);

  const welcomeFileRef = useRef<HTMLInputElement>(null);

  const handleWelcomeFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    await handleGlobalDrop(e.target.files);
    e.target.value = '';
  };

  // Show wizard overlay
  if (showWizard) {
    return (
      <>
        <SetupWizard onComplete={handleWizardComplete} />
        <ToastContainer />
      </>
    );
  }

  const showWelcome = notebooks.length === 0 && !activeNotebookId;

  if (showWelcome) {
    return (
      <>
        <div className="welcome-screen">
          <div className="welcome-content">
            <h1 className="welcome-title">Notebook LM</h1>
            <p className="welcome-subtitle">Drop a document. Ask anything.</p>
            <button
              type="button"
              className="welcome-browse-btn"
              onClick={() => welcomeFileRef.current?.click()}
            >
              Browse files
            </button>
            <input
              ref={welcomeFileRef}
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md,.py"
              multiple
              onChange={handleWelcomeFileSelect}
              style={{ display: 'none' }}
            />
            <p className="welcome-hint">or drag files anywhere on this window</p>
            <div className="welcome-tips">
              <span className="welcome-tip">PDF, Word, PowerPoint, Markdown</span>
              <span className="welcome-tip-sep" />
              <span className="welcome-tip">100% offline</span>
              <span className="welcome-tip-sep" />
              <span className="welcome-tip">&#x2318;K to search</span>
            </div>
            <div className={`welcome-status ${status}`}>
              <span className="welcome-status-dot" />
              <span>{status === 'ready' ? 'Ollama connected' : status === 'error' ? 'Offline' : 'Connecting...'}</span>
            </div>
          </div>
        </div>
        <DragOverlay onDrop={handleGlobalDrop} />
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      <div className="app-shell">
        <Sidebar />
        <ChatView pendingSuggest={pendingSuggest} onSuggestConsumed={() => setPendingSuggest(null)} />
        <SourcePanel />
      </div>

      {previewDocument && activeNotebookId && resolvedPreviewUrl && (
        <DocumentPreview
          isOpen={true}
          onClose={() => setPreviewDocument(null)}
          documentUrl={resolvedPreviewUrl}
          filename={previewDocument.filename}
        />
      )}

      <DragOverlay
        notebookName={activeNotebook?.title}
        onDrop={handleGlobalDrop}
      />
      <ConnectionBanner />
      <ToastContainer />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <KeyboardShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
