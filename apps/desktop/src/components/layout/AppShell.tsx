import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { useNotebooks } from '../../hooks/useNotebooks';
import { uploadDocument } from '../../api';
import { Sidebar } from './Sidebar';
import { SourcePanel } from './SourcePanel';
import { ChatView } from '../chat/ChatView';
import { getDocumentPreviewUrl } from '../../api';
import DocumentPreview from '../../DocumentPreview';
import { ToastContainer, showToast } from '../ui/Toast';
import { DragOverlay } from '../ui/DragOverlay';
import { ShortcutsOverlay } from '../ui/ShortcutsOverlay';
import './layout.css';

export function AppShell() {
  const previewDocument = useAppStore((s) => s.previewDocument);
  const setPreviewDocument = useAppStore((s) => s.setPreviewDocument);
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);

  const { notebooks, refresh: refreshNotebooks } = useNotebooks();

  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState<string | null>(null);

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

  const showWelcome = notebooks.length === 0 && !activeNotebookId;

  if (showWelcome) {
    return (
      <>
        <div className="welcome-screen">
          <div className="welcome-content">
            <h1 className="welcome-title">Notebook LM</h1>
            <p className="welcome-subtitle">Drop a document. Ask anything.</p>
          </div>
        </div>
        <DragOverlay onDrop={handleGlobalDrop} />
        <ShortcutsOverlay />
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      <div className="app-shell">
        <Sidebar />
        <ChatView />
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
      <ShortcutsOverlay />
      <ToastContainer />
    </>
  );
}
