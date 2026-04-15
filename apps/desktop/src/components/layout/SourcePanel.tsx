import { useAppStore } from '../../store/app-store';
import './layout.css';

export function SourcePanel() {
  const sourcePanelOpen = useAppStore((s) => s.sourcePanelOpen);
  const activeSources = useAppStore((s) => s.activeSources);
  const toggleSourcePanel = useAppStore((s) => s.toggleSourcePanel);

  if (!sourcePanelOpen) return null;

  return (
    <aside className="source-panel">
      <div className="source-panel-header">
        <h3>Sources</h3>
        <button type="button" className="source-panel-close" onClick={toggleSourcePanel}>
          &times;
        </button>
      </div>

      {activeSources.length === 0 ? (
        <div className="source-panel-empty">
          <p>Sources from your documents will appear here when you ask questions.</p>
        </div>
      ) : (
        <div className="source-panel-list">
          {activeSources.map((source, i) => (
            <div key={`${source.source_path}-${i}`} className="source-card">
              <div className="source-card-header">
                <span className="source-card-name">{source.document_name}</span>
                {source.relevance_score != null && (
                  <span className="source-card-relevance">{source.relevance_score}%</span>
                )}
              </div>
              <p className="source-card-preview">{source.preview}</p>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
