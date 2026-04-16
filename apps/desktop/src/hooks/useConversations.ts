import { useCallback, useEffect } from 'react';
import { useAppStore } from '../store/app-store';
import { listConversations, getConversationMessages, deleteConversation as apiDeleteConversation, renameConversation as apiRenameConversation } from '../api';
import { showToast } from '../components/ui/Toast';

export function useConversations() {
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);
  const conversations = useAppStore((s) => s.conversations);
  const activeConversationId = useAppStore((s) => s.activeConversationId);

  const refresh = useCallback(async () => {
    if (!activeNotebookId) {
      useAppStore.getState().setConversations([]);
      return;
    }
    try {
      const convs = await listConversations(activeNotebookId);
      useAppStore.getState().setConversations(convs);
    } catch {
      // Silently fail — conversations are not critical for app function
    }
  }, [activeNotebookId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadConversation = useCallback(async (conversationId: string) => {
    const store = useAppStore.getState();
    store.setActiveConversationId(conversationId);
    store.clearMessages();
    try {
      const msgs = await getConversationMessages(conversationId);
      for (const msg of msgs) {
        store.addMessage({ role: msg.role as 'user' | 'assistant', content: msg.content });
        if (msg.sources) {
          store.setActiveSources(msg.sources);
        }
      }
    } catch {
      showToast('Failed to load conversation', 'error');
      store.setActiveConversationId(null);
    }
  }, []);

  const deleteConv = useCallback(async (conversationId: string) => {
    try {
      await apiDeleteConversation(conversationId);
      const store = useAppStore.getState();
      if (store.activeConversationId === conversationId) {
        store.setActiveConversationId(null);
        store.clearMessages();
      }
      await refresh();
      showToast('Conversation deleted', 'success');
    } catch {
      showToast('Failed to delete conversation', 'error');
    }
  }, [refresh]);

  const renameConv = useCallback(async (conversationId: string, title: string) => {
    const store = useAppStore.getState();
    const prev = store.conversations.find((c) => c.id === conversationId);
    // Optimistic update
    store.setConversations(
      store.conversations.map((c) => c.id === conversationId ? { ...c, title } : c),
    );
    try {
      await apiRenameConversation(conversationId, title);
    } catch {
      // Revert on failure
      if (prev) {
        store.setConversations(
          store.conversations.map((c) => c.id === conversationId ? prev : c),
        );
      }
      showToast('Failed to rename conversation', 'error');
    }
  }, []);

  return {
    conversations,
    activeConversationId,
    refresh,
    loadConversation,
    deleteConversation: deleteConv,
    renameConversation: renameConv,
  };
}
