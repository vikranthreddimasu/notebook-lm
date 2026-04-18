import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { useNotebooks } from '../../hooks/useNotebooks';
import { useDocuments } from '../../hooks/useDocuments';
import { useConversations } from '../../hooks/useConversations';
import { DocumentCard } from '../documents/DocumentCard';
import { showToast } from '../ui/Toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { NotificationCenter } from '../ui/NotificationCenter';
import { createNotebook, deleteDocument, deleteNotebook, renameNotebook } from '../../api';
import { humanizeError } from '../../utils/errorMessages';
import { timeAgo } from '../../utils/timeAgo';
import type { DocumentInfo } from '../../types';
import './layout.css';

interface SidebarProps {
  onOpenZotero?: () => void;
}

type PendingConfirm =
  | { kind: 'delete-notebook'; notebookId: string; title: string }
  | { kind: 'delete-conversation'; conversationId: string; title: string }
  | { kind: 'delete-document'; notebookId: string; sourcePath: string; filename: string };

type RenameTarget =
  | { kind: 'notebook'; notebookId: string }
  | { kind: 'conversation'; conversationId: string };

const NOTEBOOK_COLORS = [
  '#7c9a82',
  '#b8977e',
  '#8b9eb0',
  '#c9956b',
  '#9b8ba0',
  '#7ea898',
  '#b09070',
  '#8a9a70',
  '#a08090',
  '#80a0a0',
];

function notebookColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return NOTEBOOK_COLORS[Math.abs(hash) % NOTEBOOK_COLORS.length];
}

const MAX_VISIBLE_CONVERSATIONS = 5;

export function Sidebar({ onOpenZotero }: SidebarProps) {
  const { notebooks, activeNotebookId, select, refresh: refreshNotebooks } = useNotebooks();
  const { documents, upload, refresh: refreshDocuments } = useDocuments();
  const {
    conversations,
    activeConversationId,
    loadConversation,
    deleteConversation: deleteConv,
    renameConversation: renameConv,
  } = useConversations();
  const status = useAppStore((s) => s.status);
  const setPreviewDocument = useAppStore((s) => s.setPreviewDocument);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; notebookId: string } | null>(null);
  const [convMenu, setConvMenu] = useState<{ x: number; y: number; conversationId: string } | null>(null);
  const [docMenu, setDocMenu] = useState<{ x: number; y: number; document: DocumentInfo } | null>(null);
  const [showAllConversations, setShowAllConversations] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!contextMenu && !convMenu && !docMenu) return;
    const handler = () => {
      setContextMenu(null);
      setConvMenu(null);
      setDocMenu(null);
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu, convMenu, docMenu]);

  useEffect(() => {
    if (renameTarget && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameTarget]);

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

  const askDeleteDocument = (doc: DocumentInfo) => {
    if (!activeNotebookId) return;
    setPendingConfirm({
      kind: 'delete-document',
      notebookId: activeNotebookId,
      sourcePath: doc.source_path,
      filename: doc.filename,
    });
    setDocMenu(null);
  };

  const confirmPending = async () => {
    if (!pendingConfirm) return;
    const current = pendingConfirm;
    setPendingConfirm(null);

    if (current.kind === 'delete-notebook') {
      try {
        await deleteNotebook(current.notebookId);
        if (activeNotebookId === current.notebookId) select(null);
        await refreshNotebooks();
        showToast('Notebook deleted', 'success');
      } catch (err) {
        showToast(humanizeError(err, { action: 'delete notebook' }), 'error');
      }
    } else if (current.kind === 'delete-conversation') {
      await deleteConv(current.conversationId);
    } else if (current.kind === 'delete-document') {
      try {
        await deleteDocument(current.notebookId, current.sourcePath);
        await refreshDocuments();
        await refreshNotebooks();
        showToast(`Removed ${current.filename}`, 'success');
      } catch (err) {
        showToast(humanizeError(err, { action: 'delete document' }), 'error');
      }
    }
  };

  const handleNewNotebook = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const nb = await createNotebook('Untitled notebook');
      await refreshNotebooks();
      select(nb.notebook_id);
      // Drop the user straight into rename mode for the new notebook.
      setRenameValue(nb.title);
      setRenameTarget({ kind: 'notebook', notebookId: nb.notebook_id });
    } catch (err) {
      showToast(humanizeError(err, { action: 'create notebook' }), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddDocumentClick = () => fileInputRef.current?.click();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    try {
      for (const file of Array.from(e.target.files)) {
        showToast(`Processing ${file.name}...`);
        await upload(file);
        showToast(`${file.name} indexed`, 'success');
      }
      await refreshNotebooks();
    } catch (err) {
      showToast(humanizeError(err, { action: 'upload' }), 'error');
    }
    e.target.value = '';
  };

  const handleRenameSubmit = async () => {
    const trimmed = renameValue.trim();
    const target = renameTarget;
    setRenameTarget(null);
    setRenameValue('');
    if (!trimmed || !target) return;

    if (target.kind === 'conversation') {
      renameConv(target.conversationId, trimmed);
    } else if (target.kind === 'notebook') {
      try {
        await renameNotebook(target.notebookId, trimmed);
        await refreshNotebooks();
      } catch (err) {
        showToast(humanizeError(err, { action: 'rename notebook' }), 'error');
      }
    }
  };

  const cancelRename = () => {
    setRenameTarget(null);
    setRenameValue('');
  };

  const beginRenameNotebook = (notebookId: string) => {
    const nb = notebooks.find((n) => n.notebook_id === notebookId);
    setRenameValue(nb?.title || '');
    setRenameTarget({ kind: 'notebook', notebookId });
    setContextMenu(null);
  };

  const beginRenameConversation = (conversationId: string) => {
    const conv = conversations.find((c) => c.id === conversationId);
    setRenameValue(conv?.title || '');
    setRenameTarget({ kind: 'conversation', conversationId });
    setConvMenu(null);
  };

  const visibleConversations = showAllConversations
    ? conversations
    : conversations.slice(0, MAX_VISIBLE_CONVERSATIONS);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Notebooks</h2>
        <button
          type="button"
          className="sidebar-new-btn"
          onClick={handleNewNotebook}
          disabled={isCreating}
          title="Create a new empty notebook"
        >
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
        {notebooks.map((nb) => {
          const isRenaming =
            renameTarget?.kind === 'notebook' && renameTarget.notebookId === nb.notebook_id;
          return (
            <div
              key={nb.notebook_id}
              className={`sidebar-notebook ${nb.notebook_id === activeNotebookId ? 'active' : ''}`}
              onClick={() => !isRenaming && select(nb.notebook_id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, notebookId: nb.notebook_id });
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isRenaming) {
                  e.preventDefault();
                  select(nb.notebook_id);
                }
              }}
            >
              <span
                className="sidebar-notebook-dot"
                style={{ background: notebookColor(nb.notebook_id) }}
              />
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  className="sidebar-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSubmit();
                    if (e.key === 'Escape') cancelRename();
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="sidebar-notebook-title">{nb.title}</span>
                  <span className="sidebar-notebook-count">{timeAgo(nb.updated_at)}</span>
                </>
              )}
            </div>
          );
        })}
        {notebooks.length === 0 && (
          <p className="sidebar-empty">Create a notebook, or drop a file anywhere.</p>
        )}
      </div>

      {activeNotebookId && conversations.length > 0 && (
        <>
          <div className="sidebar-section-title">
            <span>Conversations</span>
          </div>
          <div className="sidebar-conversations">
            {visibleConversations.map((conv) => {
              const isRenaming =
                renameTarget?.kind === 'conversation' &&
                renameTarget.conversationId === conv.id;
              return (
                <button
                  key={conv.id}
                  type="button"
                  className={`sidebar-conversation ${conv.id === activeConversationId ? 'active' : ''}`}
                  onClick={() => !isRenaming && loadConversation(conv.id)}
                >
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      className="sidebar-conversation-rename"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRenameSubmit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSubmit();
                        if (e.key === 'Escape') cancelRename();
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className="sidebar-conversation-title">{conv.title || 'Untitled'}</span>
                      <span className="sidebar-conversation-time">{timeAgo(conv.updated_at)}</span>
                      <button
                        type="button"
                        className="sidebar-conversation-menu-btn"
                        aria-label="Conversation actions"
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
              );
            })}
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
            <div className="sidebar-section-actions">
              {onOpenZotero && (
                <button
                  type="button"
                  className="sidebar-add-doc-btn"
                  onClick={onOpenZotero}
                  title="Import from Zotero"
                >
                  Zotero
                </button>
              )}
              <button
                type="button"
                className="sidebar-add-doc-btn"
                onClick={handleAddDocumentClick}
              >
                + Add
              </button>
            </div>
          </div>
          {documents.length > 0 ? (
            <div className="sidebar-documents">
              {documents.map((doc, i) => (
                <DocumentCard
                  key={`${doc.source_path}-${i}`}
                  document={doc}
                  onClick={() => setPreviewDocument(doc)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setDocMenu({ x: e.clientX, y: e.clientY, document: doc });
                  }}
                  onMenuClick={(e) =>
                    setDocMenu({ x: e.clientX, y: e.clientY, document: doc })
                  }
                />
              ))}
            </div>
          ) : (
            <div className="sidebar-no-docs">
              <button
                type="button"
                className="sidebar-upload-btn"
                onClick={handleAddDocumentClick}
              >
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
        <NotificationCenter />
      </div>

      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button
            type="button"
            className="context-menu-item"
            onClick={() => beginRenameNotebook(contextMenu.notebookId)}
          >
            Rename
          </button>
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
        <div className="context-menu" style={{ top: convMenu.y, left: convMenu.x }}>
          <button
            type="button"
            className="context-menu-item"
            onClick={() => beginRenameConversation(convMenu.conversationId)}
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

      {docMenu && (
        <div className="context-menu" style={{ top: docMenu.y, left: docMenu.x }}>
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              setPreviewDocument(docMenu.document);
              setDocMenu(null);
            }}
          >
            Open preview
          </button>
          <button
            type="button"
            className="context-menu-item context-menu-danger"
            onClick={() => askDeleteDocument(docMenu.document)}
          >
            Remove from notebook
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

      <ConfirmDialog
        open={pendingConfirm?.kind === 'delete-document'}
        danger
        title="Remove document?"
        message={
          pendingConfirm?.kind === 'delete-document'
            ? `"${pendingConfirm.filename}" will be removed from this notebook. Its chunks will be deleted; questions will no longer pull from it.`
            : ''
        }
        confirmLabel="Remove document"
        onConfirm={confirmPending}
        onCancel={() => setPendingConfirm(null)}
      />
    </aside>
  );
}
