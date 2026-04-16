import { useAppStore } from '../../store/app-store';
import './layout.css';

function relevanceColor(score: number): string {
  if (score > 70) return '#7c9a82'; // sage green
  if (score >= 40) return '#fbbf24'; // amber
  return '#a8a29e'; // muted gray
}

export function SourcePanel() {
  const activeSources = useAppStore((s) => s.activeSources);
  const crossNotebookMode = useAppStore((s) => s.crossNotebookMode);
  const notebooks = useAppStore((s) => s.notebooks);

  if (activeSources.length === 0) return null;

  return (
    <aside className="source-panel">
      <div className="source-panel-header">
        <h3>Sources</h3>
        <span className="source-panel-count">{activeSources.length}</span>
      </div>

      <div className="source-panel-list">
        {activeSources.map((source, i) => {
          const nbId = (source as Record<string, unknown>).notebook_id as string | undefined;
          const nbName = nbId ? notebooks.find((nb) => nb.notebook_id === nbId)?.title : null;

          return (
            <div key={`${source.source_path}-${i}`} className="source-card">
              {crossNotebookMode && nbName && (
                <span className="source-card-notebook">{nbName}</span>
              )}
              <span className="source-card-name">{source.document_name}</span>
              {source.relevance_score != null && (
                <div className="source-relevance-track">
                  <div
                    className="source-relevance-bar"
                    style={{
                      width: `${source.relevance_score}%`,
                      backgroundColor: relevanceColor(source.relevance_score),
                    }}
                  />
                </div>
              )}
              <p className="source-card-preview">{source.preview}</p>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
