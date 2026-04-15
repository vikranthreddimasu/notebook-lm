import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { useNotebooks } from '../../hooks/useNotebooks';
import { Sidebar } from './Sidebar';
import { SourcePanel } from './SourcePanel';
import { ChatView } from '../chat/ChatView';
import { getDocumentPreviewUrl } from '../../api';
import DocumentPreview from '../../DocumentPreview';
import { ToastContainer } from '../ui/Toast';
import { showToast } from '../ui/Toast';
import { DropZone } from '../documents/DropZone';
import { ShortcutsOverlay } from '../ui/ShortcutsOverlay';
import './layout.css';

export function AppShell() {
  const previewDocument = useAppStore((s) => s.previewDocument);
  const setPreviewDocument = useAppStore((s) => s.setPreviewDocument);
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);

  const { notebooks, refresh: refreshNotebooks } = useNotebooks();
  const [isUploading, setIsUploading] = useState(false);

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

  const handleWelcomeDrop = async (files: FileList) => {
    setIsUploading(true);
    try {
      const { uploadDocument } = await import('../../api');
      for (const file of Array.from(files)) {
        showToast(`Processing ${file.name}...`);
        const result = await uploadDocument(file);
        useAppStore.getState().setActiveNotebookId(result.notebook_id);
        showToast(`${file.name} indexed successfully`, 'success');
      }
      await refreshNotebooks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const showWelcome = notebooks.length === 0 && !activeNotebookId;

  if (showWelcome) {
    return (
      <>
        <div className="welcome-screen">
          <div className="welcome-content">
            <h1 className="welcome-title">Notebook LM</h1>
            <p className="welcome-subtitle">
              Your documents, your machine, your privacy.
            </p>
            <div className="welcome-drop-area">
              <DropZone onDrop={handleWelcomeDrop} isUploading={isUploading} />
            </div>
            <p className="welcome-hint">
              Drop a PDF, DOCX, or text file to create your first notebook.
            </p>
          </div>
        </div>
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

      <ShortcutsOverlay />
      <ToastContainer />
    </>
  );
}
