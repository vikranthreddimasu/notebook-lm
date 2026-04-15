import { useRef } from 'react';
import { useAppStore } from '../../store/app-store';
import { useNotebooks } from '../../hooks/useNotebooks';
import { useDocuments } from '../../hooks/useDocuments';
import { DocumentCard } from '../documents/DocumentCard';
import { showToast } from '../ui/Toast';
import { timeAgo } from '../../utils/timeAgo';
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
  const { notebooks, activeNotebookId, select, refresh: refreshNotebooks } = useNotebooks();
  const { documents, upload } = useDocuments();
  const status = useAppStore((s) => s.status);
  const setPreviewDocument = useAppStore((s) => s.setPreviewDocument);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNewClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    try {
      for (const file of Array.from(e.target.files)) {
        showToast(`Processing ${file.name}...`);
        await upload(file);
        showToast(`${file.name} indexed successfully`, 'success');
      }
      await refreshNotebooks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    }
    e.target.value = '';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Notebooks</h2>
        <button type="button" className="sidebar-new-btn" onClick={handleNewClick}>
          + New
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.txt,.md,.py"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
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
            <span className="sidebar-notebook-count">{timeAgo(nb.updated_at)}</span>
          </button>
        ))}
        {notebooks.length === 0 && (
          <p className="sidebar-empty">Drop a file anywhere or click + New to start.</p>
        )}
      </div>

      {activeNotebookId && documents.length > 0 && (
        <>
          <div className="sidebar-section-title">Documents</div>
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

      <div className="sidebar-footer">
        <div className={`sidebar-status ${status}`}>
          <span className="sidebar-status-dot" />
          <span>
            {status === 'ready' ? 'Ready' : status === 'error' ? 'Offline' : 'Connecting...'}
          </span>
        </div>
      </div>
    </aside>
  );
}
