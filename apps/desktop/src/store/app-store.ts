// apps/desktop/src/store/app-store.ts
import { create } from 'zustand';
import type { BackendConfig, ChatMessage, DocumentInfo, Notebook, SourceChunk } from '../types';

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

  // Documents
  documents: DocumentInfo[];

  // Sources & UI
  sourcePanelOpen: boolean;
  activeSources: SourceChunk[];
  previewDocument: DocumentInfo | null;

  // Actions — connection
  setStatus: (status: AppState['status']) => void;
  setConfig: (config: BackendConfig) => void;

  // Actions — notebooks
  setNotebooks: (notebooks: Notebook[]) => void;
  setActiveNotebookId: (id: string | null) => void;

  // Actions — chat
  addMessage: (msg: ChatMessage) => void;
  updateMessageAt: (index: number, content: string) => void;
  clearMessages: () => void;
  setIsStreaming: (val: boolean) => void;

  // Actions — documents
  setDocuments: (docs: DocumentInfo[]) => void;

  // Actions — sources & UI
  setActiveSources: (sources: SourceChunk[]) => void;
  toggleSourcePanel: () => void;
  setPreviewDocument: (doc: DocumentInfo | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  status: 'checking',
  config: null,
  notebooks: [],
  activeNotebookId: null,
  messages: [],
  isStreaming: false,
  documents: [],
  sourcePanelOpen: true,
  activeSources: [],
  previewDocument: null,

  // Connection
  setStatus: (status) => set({ status }),
  setConfig: (config) => set({ config }),

  // Notebooks — switching clears chat and documents
  setNotebooks: (notebooks) => set({ notebooks }),
  setActiveNotebookId: (id) =>
    set({ activeNotebookId: id, messages: [], activeSources: [], documents: [] }),

  // Chat
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  updateMessageAt: (index, content) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages[index]) {
        messages[index] = { ...messages[index], content };
      }
      return { messages };
    }),
  clearMessages: () => set({ messages: [], activeSources: [] }),
  setIsStreaming: (val) => set({ isStreaming: val }),

  // Documents
  setDocuments: (docs) => set({ documents: docs }),

  // Sources & UI
  setActiveSources: (sources) => set({ activeSources: sources }),
  toggleSourcePanel: () => set((state) => ({ sourcePanelOpen: !state.sourcePanelOpen })),
  setPreviewDocument: (doc) => set({ previewDocument: doc }),
}));
