import { useAppStore } from '../../store/app-store';
import { Sidebar } from './Sidebar';
import { SourcePanel } from './SourcePanel';
import { ChatView } from '../chat/ChatView';
import { getDocumentPreviewUrl } from '../../api';
import DocumentPreview from '../../DocumentPreview';
import './layout.css';

export function AppShell() {
  const previewDocument = useAppStore((s) => s.previewDocument);
  const setPreviewDocument = useAppStore((s) => s.setPreviewDocument);
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);

  return (
    <>
      <div className="app-shell">
        <Sidebar />
        <ChatView />
        <SourcePanel />
      </div>

      {previewDocument && activeNotebookId && (
        <DocumentPreview
          isOpen={true}
          onClose={() => setPreviewDocument(null)}
          documentUrl={getDocumentPreviewUrl(activeNotebookId, previewDocument.source_path)}
          filename={previewDocument.filename}
        />
      )}
    </>
  );
}
