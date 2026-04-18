import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { useNotebooks } from '../../hooks/useNotebooks';
import { useDocuments } from '../../hooks/useDocuments';
import { useConversations } from '../../hooks/useConversations';
import { DocumentCard } from '../documents/DocumentCard';
import { showToast } from '../ui/Toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { deleteNotebook } from '../../api';
import { timeAgo } from '../../utils/timeAgo';
import './layout.css';

type PendingConfirm =
  | { kind: 'delete-notebook'; notebookId: string; title: string }
  | { kind: 'delete-conversation'; conversationId: string; title: string };

// Lazy Scholar palette: warm, muted tones that match the stone-sage design system
const NOTEBOOK_COLORS = [
  '#7c9a82', // sage (primary accent)
  '#b8977e', // warm tan
  '#8b9eb0', // slate blue
  '#c9956b', // amber stone
  '#9b8ba0', // dusty mauve
  '#7ea898', // sea glass
  '#b09070', // clay
  '#8a9a70', // olive
  '#a08090', // muted rose
  '#80a0a0', // teal stone
];

function notebookColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return NOTEBOOK_COLORS[Math.abs(hash) % NOTEBOOK_COLORS.length];
}

const MAX_VISIBLE_CONVERSATIONS = 5;

export function Sidebar() {
  const { notebooks, activeNotebookId, select, refresh: refreshNotebooks } = useNotebooks();
  const { documents, upload } = useDocuments();
  const { conversations, activeConversationId, loadConversation, deleteConversation: deleteConv, renameConversation: renameConv } = useConversations();
  const status = useAppStore((s) => s.status);
  const setPreviewDocument = useAppStore((s) => s.setPreviewDocument);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; notebookId: string } | null>(null);
  const [convMenu, setConvMenu] = useState<{ x: number; y: number; conversationId: string } | null>(null);
  const [showAllConversations, setShowAllConversations] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!contextMenu && !convMenu) return;
    const handler = () => { setContextMenu(null); setConvMenu(null); };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu, convMenu]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const askDeleteNotebook = (notebookId: string) => {
    const nb = notebooks.find((n) => n.notebook_id === notebookId);
    setPendingConfirm({
      kind: 'delete-notebook',
      notebookId,
      title: nb?.title || 'this notebook',
    });
    setContextMenu(null);
  };

  const askDeleteConversation = (conversationId: string) => {
    const conv = conversations.find((c) => c.id === conversationId);
    setPendingConfirm({
      kind: 'delete-conversation',
      conversationId,
      title: conv?.title || 'this conversation',
    });
    setConvMenu(null);
  };

  const confirmPending = async () => {
    if (!pendingConfirm) return;
    const current = pendingConfirm;
    setPendingConfirm(null);

    if (current.kind === 'delete-notebook') {
      try {
        await deleteNotebook(current.notebookId);
        if (activeNotebookId === current.notebookId) {
          select(null);
        }
        await refreshNotebooks();
        showToast('Notebook deleted', 'success');
      } catch {
        showToast('Failed to delete notebook', 'error');
      }
    } else if (current.kind === 'delete-conversation') {
      await deleteConv(current.conversationId);
    }
  };

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

  const handleRenameSubmit = (conversationId: string) => {
    if (renameValue.trim()) {
      renameConv(conversationId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const visibleConversations = showAllConversations
    ? conversations
    : conversations.slice(0, MAX_VISIBLE_CONVERSATIONS);

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
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, notebookId: nb.notebook_id });
            }}
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

      {activeNotebookId && conversations.length > 0 && (
        <>
          <div className="sidebar-section-title">
            <span>Conversations</span>
          </div>
          <div className="sidebar-conversations">
            {visibleConversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                className={`sidebar-conversation ${conv.id === activeConversationId ? 'active' : ''}`}
                onClick={() => loadConversation(conv.id)}
              >
                {renamingId === conv.id ? (
                  <input
                    ref={renameInputRef}
                    className="sidebar-conversation-rename"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRenameSubmit(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit(conv.id);
                      if (e.key === 'Escape') {
                        setRenamingId(null);
                        setRenameValue('');
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="sidebar-conversation-title">
                      {conv.title || 'Untitled'}
                    </span>
                    <span className="sidebar-conversation-time">
                      {timeAgo(conv.updated_at)}
                    </span>
                    <button
                      type="button"
                      className="sidebar-conversation-menu-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConvMenu({ x: e.clientX, y: e.clientY, conversationId: conv.id });
                      }}
                    >
                      ...
                    </button>
                  </>
                )}
              </button>
            ))}
            {conversations.length > MAX_VISIBLE_CONVERSATIONS && !showAllConversations && (
              <button
                type="button"
                className="sidebar-show-all-btn"
                onClick={() => setShowAllConversations(true)}
              >
                Show all ({conversations.length})
              </button>
            )}
            {showAllConversations && conversations.length > MAX_VISIBLE_CONVERSATIONS && (
              <button
                type="button"
                className="sidebar-show-all-btn"
                onClick={() => setShowAllConversations(false)}
              >
                Show less
              </button>
            )}
          </div>
        </>
      )}

      {activeNotebookId && (
        <>
          <div className="sidebar-section-title">
            <span>Documents</span>
            <button type="button" className="sidebar-add-doc-btn" onClick={handleNewClick}>
              + Add
            </button>
          </div>
          {documents.length > 0 ? (
            <div className="sidebar-documents">
              {documents.map((doc, i) => (
                <DocumentCard
                  key={i}
                  document={doc}
                  onClick={() => setPreviewDocument(doc)}
                />
              ))}
            </div>
          ) : (
            <div className="sidebar-no-docs">
              <button type="button" className="sidebar-upload-btn" onClick={handleNewClick}>
                Upload a document
              </button>
              <p>or drag files anywhere</p>
            </div>
          )}
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

      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            type="button"
            className="context-menu-item context-menu-danger"
            onClick={() => askDeleteNotebook(contextMenu.notebookId)}
          >
            Delete notebook
          </button>
        </div>
      )}

      {convMenu && (
        <div
          className="context-menu"
          style={{ top: convMenu.y, left: convMenu.x }}
        >
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              const conv = conversations.find((c) => c.id === convMenu.conversationId);
              setRenameValue(conv?.title || '');
              setRenamingId(convMenu.conversationId);
              setConvMenu(null);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="context-menu-item context-menu-danger"
            onClick={() => askDeleteConversation(convMenu.conversationId)}
          >
            Delete
          </button>
        </div>
      )}

      <ConfirmDialog
        open={pendingConfirm?.kind === 'delete-notebook'}
        danger
        title="Delete notebook?"
        message={
          pendingConfirm?.kind === 'delete-notebook'
            ? `"${pendingConfirm.title}" and all of its documents, embeddings, and conversations will be permanently deleted. This can't be undone.`
            : ''
        }
        confirmLabel="Delete notebook"
        onConfirm={confirmPending}
        onCancel={() => setPendingConfirm(null)}
      />

      <ConfirmDialog
        open={pendingConfirm?.kind === 'delete-conversation'}
        danger
        title="Delete conversation?"
        message={
          pendingConfirm?.kind === 'delete-conversation'
            ? `"${pendingConfirm.title}" and all of its messages will be permanently deleted. This can't be undone.`
            : ''
        }
        confirmLabel="Delete conversation"
        onConfirm={confirmPending}
        onCancel={() => setPendingConfirm(null)}
      />
    </aside>
  );
}
