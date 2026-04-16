import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { useNotebooks } from '../../hooks/useNotebooks';
import { showToast } from './Toast';
import './zotero-import.css';

interface ZoteroCollection {
  id: number;
  name: string;
  parent_id: number | null;
  paper_count: number;
}

interface ZoteroLibrary {
  detected: boolean;
  data_dir: string | null;
  total_items: number;
  total_pdfs: number;
  collections: ZoteroCollection[];
  error: string | null;
}

async function getApiBase(): Promise<string> {
  if (window.notebookBridge?.backendUrl) {
    try {
      const url = await window.notebookBridge.backendUrl();
      if (url) return `${url}/api`;
    } catch {}
  }
  return (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000/api';
}

export function ZoteroImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [library, setLibrary] = useState<ZoteroLibrary | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importResult, setImportResult] = useState<string | null>(null);
  const { refresh: refreshNotebooks } = useNotebooks();

  useEffect(() => {
    if (!open) return;
    setLibrary(null);
    setSelected(new Set());
    setImportResult(null);
    detectZotero();
  }, [open]);

  async function detectZotero() {
    setLoading(true);
    try {
      const base = await getApiBase();
      const res = await fetch(`${base}/zotero/detect`);
      const data: ZoteroLibrary = await res.json();
      setLibrary(data);
      if (data.detected && data.collections.length > 0) {
        setSelected(new Set(data.collections.map((c) => c.id)));
      }
    } catch (err) {
      setLibrary({ detected: false, data_dir: null, total_items: 0, total_pdfs: 0, collections: [], error: 'Failed to connect to backend' });
    }
    setLoading(false);
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const base = await getApiBase();
      const res = await fetch(`${base}/zotero/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection_ids: Array.from(selected),
          data_dir: library?.data_dir,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || 'Import failed', 'error');
        setImporting(false);
        return;
      }
      setImportResult(
        `Imported ${data.total_pdfs} PDFs into ${data.collections_imported} notebooks (${data.total_chunks} chunks indexed)`
      );
      showToast(`Zotero import complete: ${data.total_pdfs} PDFs`, 'success');
      await refreshNotebooks();
    } catch (err) {
      showToast('Import failed', 'error');
    }
    setImporting(false);
  }

  function toggleCollection(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!library) return;
    if (selected.size === library.collections.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(library.collections.map((c) => c.id)));
    }
  }

  if (!open) return null;

  return (
    <div className="zotero-backdrop" onClick={onClose}>
      <div className="zotero-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="zotero-title">Import from Zotero</h2>

        {loading && (
          <div className="zotero-status">
            <span className="zotero-spinner" />
            Detecting Zotero library...
          </div>
        )}

        {library && !library.detected && (
          <div className="zotero-status zotero-status-error">
            <p>Zotero library not found.</p>
            <p className="zotero-hint">{library.error || 'Make sure Zotero is installed and has been opened at least once.'}</p>
          </div>
        )}

        {library && library.detected && !importResult && (
          <>
            <p className="zotero-summary">
              {library.total_items} items, {library.total_pdfs} PDFs in {library.collections.length} collections
            </p>

            <div className="zotero-collections">
              <label className="zotero-select-all">
                <input
                  type="checkbox"
                  checked={selected.size === library.collections.length}
                  onChange={toggleAll}
                />
                Select all
              </label>
              {library.collections.map((c) => (
                <label key={c.id} className="zotero-collection-row">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleCollection(c.id)}
                  />
                  <span className="zotero-collection-name">{c.name}</span>
                  <span className="zotero-collection-count">{c.paper_count} papers</span>
                </label>
              ))}
              {library.collections.length === 0 && (
                <p className="zotero-hint">No collections found. Create collections in Zotero first.</p>
              )}
            </div>

            <div className="zotero-actions">
              <button
                type="button"
                className="zotero-btn zotero-btn-primary"
                onClick={handleImport}
                disabled={importing || selected.size === 0}
              >
                {importing ? (
                  <>
                    <span className="zotero-spinner" />
                    Importing...
                  </>
                ) : (
                  `Import ${selected.size} collection${selected.size !== 1 ? 's' : ''}`
                )}
              </button>
              <button type="button" className="zotero-btn zotero-btn-text" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}

        {importResult && (
          <div className="zotero-result">
            <p>{importResult}</p>
            <button type="button" className="zotero-btn zotero-btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
