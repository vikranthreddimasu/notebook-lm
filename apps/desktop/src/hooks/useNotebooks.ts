import { useCallback, useEffect } from 'react';
import { useAppStore } from '../store/app-store';
import { listNotebooks, createNotebook } from '../api';
import { showToast } from '../components/ui/Toast';

export function useNotebooks() {
  const notebooks = useAppStore((s) => s.notebooks);
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);
  const setNotebooks = useAppStore((s) => s.setNotebooks);
  const setActiveNotebookId = useAppStore((s) => s.setActiveNotebookId);

  const refresh = useCallback(async () => {
    try {
      const result = await listNotebooks();
      setNotebooks(result);
      // Auto-select most recent notebook if none active
      if (!useAppStore.getState().activeNotebookId && result.length > 0) {
        useAppStore.getState().setActiveNotebookId(result[0].notebook_id);
      }
    } catch (err) {
      console.error('Failed to load notebooks', err);
    }
  }, [setNotebooks]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (title?: string) => {
      const notebook = await createNotebook(title);
      await refresh();
      setActiveNotebookId(notebook.notebook_id);
      return notebook;
    },
    [refresh, setActiveNotebookId],
  );

  const select = useCallback(
    (id: string | null) => {
      const store = useAppStore.getState();
      if (store.activeConversationId && store.messages.length > 0) {
        showToast('Conversation saved', 'success');
      }
      setActiveNotebookId(id);
    },
    [setActiveNotebookId],
  );

  return { notebooks, activeNotebookId, refresh, create, select };
}
