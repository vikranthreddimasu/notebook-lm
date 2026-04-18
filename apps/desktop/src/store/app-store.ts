// apps/desktop/src/store/app-store.ts
import { create } from 'zustand';
import type { BackendConfig, ChatMessage, Conversation, DocumentInfo, Notebook, SourceChunk } from '../types';

export type NotificationLevel = 'info' | 'success' | 'error' | 'warning';

export interface AppNotification {
  id: string;
  level: NotificationLevel;
  title: string;
  body?: string;
  timestamp: number;
  /** True until the user opens the center or dismisses it. */
  unread: boolean;
}

const MAX_NOTIFICATIONS = 50;

function makeId(): string {
  // crypto.randomUUID is available in Electron's renderer and modern browsers.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

interface AppState {
  // Connection
  status: 'checking' | 'ready' | 'error';
  config: BackendConfig | null;

  // Notebooks
  notebooks: Notebook[];
  activeNotebookId: string | null;

  // Chat
  messages: ChatMessage[];
  isStreaming: boolean;

  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;

  // Cross-notebook
  crossNotebookMode: boolean;

  // Documents
  documents: DocumentInfo[];

  // Sources & UI
  sourcePanelOpen: boolean;
  activeSources: SourceChunk[];
  previewDocument: DocumentInfo | null;

  // Notifications (persistent log — toasts are ephemeral, these stick around)
  notifications: AppNotification[];

  // Actions — connection
  setStatus: (status: AppState['status']) => void;
  setConfig: (config: BackendConfig) => void;

  // Actions — notebooks
  setNotebooks: (notebooks: Notebook[]) => void;
  setActiveNotebookId: (id: string | null) => void;

  // Actions — chat
  /** Add a message. If `msg.id` is omitted, a stable id is generated. Returns the id. */
  addMessage: (msg: Omit<ChatMessage, 'id'> & { id?: string }) => string;
  /** Replace the content of a message by id. Marks streaming=false when done. */
  updateMessage: (id: string, patch: Partial<Omit<ChatMessage, 'id'>>) => void;
  /** Remove a message by id (used when the user aborts an empty assistant turn). */
  removeMessage: (id: string) => void;
  /** Bulk replace messages — used when loading a historical conversation. */
  setMessages: (messages: ChatMessage[]) => void;
  /** Clear on-screen chat AND forget the active conversation (user-initiated "new chat"). */
  newChat: () => void;
  /** Clear on-screen chat only — used internally when loading a different conversation.
   *  Does NOT touch activeConversationId so callers can restore state on fetch failure. */
  resetMessagesOnly: () => void;
  setIsStreaming: (val: boolean) => void;

  // Actions — conversations
  setConversations: (convs: Conversation[]) => void;
  setActiveConversationId: (id: string | null) => void;

  // Actions — cross-notebook
  setCrossNotebookMode: (val: boolean) => void;

  // Actions — documents
  setDocuments: (docs: DocumentInfo[]) => void;

  // Actions — sources & UI
  setActiveSources: (sources: SourceChunk[]) => void;
  toggleSourcePanel: () => void;
  setSourcePanelOpen: (open: boolean) => void;
  setPreviewDocument: (doc: DocumentInfo | null) => void;

  // Actions — notifications
  addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'unread'>) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  dismissNotification: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  status: 'checking',
  config: null,
  notebooks: [],
  activeNotebookId: null,
  messages: [],
  isStreaming: false,
  conversations: [],
  activeConversationId: null,
  crossNotebookMode: false,
  documents: [],
  sourcePanelOpen: true,
  activeSources: [],
  previewDocument: null,
  notifications: [],

  // Connection
  setStatus: (status) => set({ status }),
  setConfig: (config) => set({ config }),

  // Notebooks — switching resets notebook-scoped state. Conversation and
  // in-flight stream should be canceled by the caller BEFORE this is invoked.
  setNotebooks: (notebooks) => set({ notebooks }),
  setActiveNotebookId: (id) =>
    set({
      activeNotebookId: id,
      messages: [],
      activeSources: [],
      documents: [],
      activeConversationId: null,
    }),

  // Chat
  addMessage: (msg) => {
    const id = msg.id ?? makeId();
    set((state) => ({ messages: [...state.messages, { ...msg, id }] }));
    return id;
  },
  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  removeMessage: (id) =>
    set((state) => ({ messages: state.messages.filter((m) => m.id !== id) })),
  setMessages: (messages) => set({ messages }),
  newChat: () =>
    set({ messages: [], activeSources: [], activeConversationId: null, isStreaming: false }),
  resetMessagesOnly: () => set({ messages: [], activeSources: [] }),
  setIsStreaming: (val) => set({ isStreaming: val }),

  // Conversations
  setConversations: (convs) => set({ conversations: convs }),
  setActiveConversationId: (id) => set({ activeConversationId: id }),

  // Cross-notebook
  setCrossNotebookMode: (val) => set({ crossNotebookMode: val }),

  // Documents
  setDocuments: (docs) => set({ documents: docs }),

  // Sources & UI
  setActiveSources: (sources) => set({ activeSources: sources }),
  toggleSourcePanel: () => set((state) => ({ sourcePanelOpen: !state.sourcePanelOpen })),
  setSourcePanelOpen: (open) => set({ sourcePanelOpen: open }),
  setPreviewDocument: (doc) => set({ previewDocument: doc }),

  // Notifications — newest first, capped so the log doesn't grow unbounded
  addNotification: (n) =>
    set((state) => ({
      notifications: [
        { ...n, id: makeId(), timestamp: Date.now(), unread: true },
        ...state.notifications,
      ].slice(0, MAX_NOTIFICATIONS),
    })),
  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, unread: false })),
    })),
  clearNotifications: () => set({ notifications: [] }),
  dismissNotification: (id) =>
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
}));
