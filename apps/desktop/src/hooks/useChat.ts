import { useCallback, useRef } from 'react';
import { useAppStore } from '../store/app-store';
import { streamChatMessage, sendChatMessage } from '../api';
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
      };

      const handleEvent = (event: ChatStreamEvent) => {
        const s = useAppStore.getState();
        switch (event.type) {
          case 'meta': {
            const sources: SourceChunk[] = (event.sources ?? []).map((src) => ({
              ...src,
              document_name: src.source_path.split(/[/\\]/).pop() ?? src.source_path,
              relevance_score:
                src.distance != null ? Math.round((1 - src.distance) * 100) : undefined,
            }));
            s.setActiveSources(sources);
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
            break;
          case 'error':
            if (assistantIndexRef.current !== null) {
              s.updateMessageAt(assistantIndexRef.current, `Error: ${event.message}`);
            }
            s.setIsStreaming(false);
            assistantIndexRef.current = null;
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
    useAppStore.getState().clearMessages();
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
