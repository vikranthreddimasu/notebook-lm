import { useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { useNotebooks } from '../../hooks/useNotebooks';
import { useDocuments } from '../../hooks/useDocuments';
import { DocumentCard } from '../documents/DocumentCard';
import { DropZone } from '../documents/DropZone';
import { showToast } from '../ui/Toast';
import './layout.css';

const NOTEBOOK_COLORS = [
  '#818cf8', '#f472b6', '#34d399', '#fbbf24', '#60a5fa',
  '#a78bfa', '#fb923c', '#2dd4bf', '#f87171', '#a3e635',
];

function notebookColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return NOTEBOOK_COLORS[Math.abs(hash) % NOTEBOOK_COLORS.length];
}

export function Sidebar() {
  const { notebooks, activeNotebookId, create, select, refresh: refreshNotebooks } = useNotebooks();
  const { documents, upload } = useDocuments();
  const config = useAppStore((s) => s.config);
  const status = useAppStore((s) => s.status);
  const setPreviewDocument = useAppStore((s) => s.setPreviewDocument);

  const [isUploading, setIsUploading] = useState(false);

  const handleDrop = async (files: FileList) => {
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        showToast(`Processing ${file.name}...`);
        await upload(file);
        showToast(`${file.name} indexed successfully`, 'success');
      }
      await refreshNotebooks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Notebooks</h2>
        <button type="button" className="sidebar-new-btn" onClick={() => create()}>
          + New
        </button>
      </div>

      <div className="sidebar-notebooks">
        {notebooks.map((nb) => (
          <button
            key={nb.notebook_id}
            type="button"
            className={`sidebar-notebook ${nb.notebook_id === activeNotebookId ? 'active' : ''}`}
            onClick={() => select(nb.notebook_id)}
          >
            <span className="sidebar-notebook-dot" style={{ background: notebookColor(nb.notebook_id) }} />
            <span className="sidebar-notebook-title">{nb.title}</span>
            <span className="sidebar-notebook-count">{nb.source_count} docs</span>
          </button>
        ))}
        {notebooks.length === 0 && (
          <p className="sidebar-empty">Upload a document to create your first notebook.</p>
        )}
      </div>

      {activeNotebookId && documents.length > 0 && (
        <>
          <div className="sidebar-section-title">Documents ({documents.length})</div>
          <div className="sidebar-documents">
            {documents.map((doc, i) => (
              <DocumentCard
                key={i}
                document={doc}
                onClick={() => setPreviewDocument(doc)}
              />
            ))}
          </div>
        </>
      )}

      <DropZone onDrop={handleDrop} isUploading={isUploading} />

      <div className="sidebar-footer">
        <div className={`sidebar-status ${status}`}>
          <span className="sidebar-status-dot" />
          <span>
            {config
              ? (config.resolved_ollama_model ?? config.ollama_model)
              : 'Connecting...'}
          </span>
        </div>
      </div>
    </aside>
  );
}
