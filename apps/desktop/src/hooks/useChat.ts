import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../store/app-store';
import { streamChatMessage, sendChatMessage, listConversations } from '../api';
import { showToast } from '../components/ui/Toast';
import type { ChatStreamEvent, SourceChunk } from '../types';

export function useChat() {
  const messages = useAppStore((s) => s.messages);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);

  const assistantIdRef = useRef<string | null>(null);
  const bufferRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);
  // True only for genuine user-initiated aborts, so we know not to fall back to
  // the non-streaming endpoint (otherwise "stop" still delivers the full reply).
  const userAbortedRef = useRef(false);

  // Cancel any in-flight stream when the user switches notebooks. The store's
  // setActiveNotebookId also clears messages and activeSources, so we just
  // need to tear down the network side here.
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        userAbortedRef.current = true;
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [activeNotebookId]);

  const send = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || useAppStore.getState().isStreaming) return;

      const store = useAppStore.getState();
      // Build history from only the messages visible to the user. A previously
      // aborted assistant turn, if still on screen, was already pruned below —
      // but filter defensively in case.
      const history = store.messages
        .filter((m) => !(m.role === 'assistant' && m.aborted && m.content === ''))
        .map((m) => ({ role: m.role, content: m.content }));

      store.addMessage({ role: 'user', content: prompt });
      const assistantId = store.addMessage({ role: 'assistant', content: '', streaming: true });
      assistantIdRef.current = assistantId;
      bufferRef.current = '';

      store.setIsStreaming(true);
      store.setActiveSources([]);

      const crossMode = store.crossNotebookMode;
      const body = {
        prompt,
        history,
        notebook_id: crossMode ? null : store.activeNotebookId,
        notebook_ids: crossMode ? store.notebooks.map((nb) => nb.notebook_id) : null,
        conversation_id: store.activeConversationId,
      };

      const handleEvent = (event: ChatStreamEvent) => {
        const s = useAppStore.getState();
        const id = assistantIdRef.current;
        switch (event.type) {
          case 'meta': {
            const sources: SourceChunk[] = (event.sources ?? []).map((src) => ({
              ...src,
              document_name: src.source_path.split(/[/\\]/).pop() ?? src.source_path,
              relevance_score: src.relevance_score,
            }));
            s.setActiveSources(sources);
            if (event.conversation_id && !s.activeConversationId) {
              s.setActiveConversationId(event.conversation_id);
              const firstMsg = s.messages.find((m) => m.role === 'user');
              if (firstMsg) {
                const title = firstMsg.content.slice(0, 50).trim();
                s.setConversations([
                  {
                    id: event.conversation_id,
                    notebook_id: s.activeNotebookId ?? '',
                    title,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  ...s.conversations,
                ]);
              }
            }
            break;
          }
          case 'token':
            bufferRef.current += event.delta;
            if (id) s.updateMessage(id, { content: bufferRef.current });
            break;
          case 'done':
            if (id) s.updateMessage(id, { content: event.reply, streaming: false });
            s.setIsStreaming(false);
            assistantIdRef.current = null;
            if (s.activeNotebookId) {
              listConversations(s.activeNotebookId)
                .then((convs) => useAppStore.getState().setConversations(convs))
                .catch(() => {});
            }
            break;
          case 'error':
            if (id) s.updateMessage(id, { content: `Error: ${event.message}`, streaming: false });
            s.setIsStreaming(false);
            assistantIdRef.current = null;
            break;
          case 'warning':
            showToast(event.message, 'error');
            break;
        }
      };

      const controller = new AbortController();
      abortRef.current = controller;
      userAbortedRef.current = false;

      try {
        await streamChatMessage(body, handleEvent, controller.signal);
        abortRef.current = null;
      } catch (err) {
        const wasUserAbort = userAbortedRef.current || controller.signal.aborted;
        abortRef.current = null;

        if (wasUserAbort) {
          // User clicked stop. Mark the partial message as aborted and bail —
          // do NOT fall back to the non-streaming endpoint (that would ignore
          // the abort and deliver the full reply anyway).
          const id = assistantIdRef.current;
          if (id) {
            const state = useAppStore.getState();
            const msg = state.messages.find((m) => m.id === id);
            if (msg && msg.content.length === 0) {
              // Nothing to keep — remove the empty assistant bubble entirely.
              state.removeMessage(id);
            } else if (id) {
              state.updateMessage(id, { streaming: false, aborted: true });
            }
          }
          useAppStore.getState().setIsStreaming(false);
          assistantIdRef.current = null;
          return;
        }

        // Real stream failure — try non-streaming fallback, but respect abort.
        try {
          const response = await sendChatMessage(body);
          const id = assistantIdRef.current;
          if (id) useAppStore.getState().updateMessage(id, { content: response.reply, streaming: false });
        } catch (fallbackErr) {
          const id = assistantIdRef.current;
          if (id) {
            const msg =
              fallbackErr instanceof Error ? fallbackErr.message : 'Failed to get response';
            useAppStore.getState().updateMessage(id, { content: `Error: ${msg}`, streaming: false });
          }
          // Original stream error tells us more than the fallback one, usually.
          console.warn('[chat] stream failed, fallback also failed', err, fallbackErr);
        } finally {
          useAppStore.getState().setIsStreaming(false);
          assistantIdRef.current = null;
        }
      }
    },
    [],
  );

  const clearChat = useCallback(() => {
    // Also tear down any in-flight stream so it doesn't keep streaming into
    // a conversation the user just wiped.
    if (abortRef.current) {
      userAbortedRef.current = true;
      abortRef.current.abort();
      abortRef.current = null;
    }
    useAppStore.getState().newChat();
  }, []);

  const abort = useCallback(() => {
    if (abortRef.current) {
      userAbortedRef.current = true;
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
