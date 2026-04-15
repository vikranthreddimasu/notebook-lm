import { useCallback, useEffect } from 'react';
import { useAppStore } from '../store/app-store';
import { listDocuments, uploadDocument } from '../api';

export function useDocuments() {
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);
  const documents = useAppStore((s) => s.documents);
  const setDocuments = useAppStore((s) => s.setDocuments);

  const refresh = useCallback(async () => {
    if (!activeNotebookId) {
      setDocuments([]);
      return;
    }
    try {
      const result = await listDocuments(activeNotebookId);
      setDocuments(result.documents);
    } catch (err) {
      console.error('Failed to load documents', err);
    }
  }, [activeNotebookId, setDocuments]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upload = useCallback(
    async (file: File) => {
      const notebookId = useAppStore.getState().activeNotebookId;
      const result = await uploadDocument(file, notebookId || undefined);
      if (!notebookId) {
        useAppStore.getState().setActiveNotebookId(result.notebook_id);
      }
      await refresh();
      return result;
    },
    [refresh],
  );

  return { documents, refresh, upload };
}
