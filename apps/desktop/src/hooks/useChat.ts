import { useCallback, useRef } from 'react';
import { useAppStore } from '../store/app-store';
import { streamChatMessage, sendChatMessage, listConversations } from '../api';
import { showToast } from '../components/ui/Toast';
import type { ChatStreamEvent, SourceChunk } from '../types';

export function useChat() {
  const messages = useAppStore((s) => s.messages);
  const isStreaming = useAppStore((s) => s.isStreaming);

  const assistantIndexRef = useRef<number | null>(null);
  const bufferRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || useAppStore.getState().isStreaming) return;

      const store = useAppStore.getState();
      const history = store.messages.map((m) => ({ role: m.role, content: m.content }));

      store.addMessage({ role: 'user', content: prompt });

      const afterUser = useAppStore.getState().messages;
      const assistantIndex = afterUser.length;
      store.addMessage({ role: 'assistant', content: '' });
      assistantIndexRef.current = assistantIndex;
      bufferRef.current = '';

      store.setIsStreaming(true);
      store.setActiveSources([]);

      const body = {
        prompt,
        history,
        notebook_id: store.activeNotebookId,
        conversation_id: store.activeConversationId,
      };

      const handleEvent = (event: ChatStreamEvent) => {
        const s = useAppStore.getState();
        switch (event.type) {
          case 'meta': {
            const sources: SourceChunk[] = (event.sources ?? []).map((src) => ({
              ...src,
              document_name: src.source_path.split(/[/\\]/).pop() ?? src.source_path,
              // Relevance score comes from backend normalization. No frontend calculation.
              relevance_score: undefined,
            }));
            s.setActiveSources(sources);
            // Capture conversation_id from backend (created on first message)
            if (event.conversation_id && !s.activeConversationId) {
              s.setActiveConversationId(event.conversation_id);
              // Optimistic title: use first user message
              const firstMsg = s.messages.find((m) => m.role === 'user');
              if (firstMsg) {
                const title = firstMsg.content.slice(0, 50).trim();
                s.setConversations([
                  { id: event.conversation_id, notebook_id: s.activeNotebookId ?? '', title, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
                  ...s.conversations,
                ]);
              }
            }
            break;
          }
          case 'token':
            bufferRef.current += event.delta;
            if (assistantIndexRef.current !== null) {
              s.updateMessageAt(assistantIndexRef.current, bufferRef.current);
            }
            break;
          case 'done':
            if (assistantIndexRef.current !== null) {
              s.updateMessageAt(assistantIndexRef.current, event.reply);
            }
            s.setIsStreaming(false);
            assistantIndexRef.current = null;
            // Refresh conversation list to get backend-accurate titles
            if (s.activeNotebookId) {
              listConversations(s.activeNotebookId)
                .then((convs) => useAppStore.getState().setConversations(convs))
                .catch(() => {});
            }
            break;
          case 'error':
            if (assistantIndexRef.current !== null) {
              s.updateMessageAt(assistantIndexRef.current, `Error: ${event.message}`);
            }
            s.setIsStreaming(false);
            assistantIndexRef.current = null;
            break;
          case 'warning':
            showToast(event.message, 'error');
            break;
        }
      };

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChatMessage(body, handleEvent, controller.signal);
        abortRef.current = null;
      } catch {
        abortRef.current = null;
        try {
          const response = await sendChatMessage(body);
          if (assistantIndexRef.current !== null) {
            useAppStore.getState().updateMessageAt(assistantIndexRef.current, response.reply);
          }
        } catch (fallbackErr) {
          if (assistantIndexRef.current !== null) {
            const msg =
              fallbackErr instanceof Error ? fallbackErr.message : 'Failed to get response';
            useAppStore.getState().updateMessageAt(assistantIndexRef.current, `Error: ${msg}`);
          }
        } finally {
          useAppStore.getState().setIsStreaming(false);
          assistantIndexRef.current = null;
        }
      }
    },
    [],
  );

  const clearChat = useCallback(() => {
    const s = useAppStore.getState();
    s.clearMessages();
    s.setActiveConversationId(null);
  }, []);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    const s = useAppStore.getState();
    if (s.isStreaming) {
      s.setIsStreaming(false);
    }
  }, []);

  return { messages, isStreaming, send, clearChat, abort };
}
