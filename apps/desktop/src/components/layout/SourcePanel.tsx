import { useAppStore } from '../../store/app-store';
import './layout.css';

function relevanceColor(score: number): string {
  if (score > 70) return '#7c9a82'; // sage green
  if (score >= 40) return '#fbbf24'; // amber
  return '#a8a29e'; // muted gray
}

interface SourcePanelProps {
  onSourceClick?: (sourcePath: string, highlightText: string) => void;
}

export function SourcePanel({ onSourceClick }: SourcePanelProps) {
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
          const nbId = source.notebook_id;
          const nbName = nbId ? notebooks.find((nb) => nb.notebook_id === nbId)?.title : null;

          return (
            <div
              key={`${source.source_path}-${i}`}
              className={`source-card ${onSourceClick ? 'source-card-clickable' : ''}`}
              onClick={() => onSourceClick?.(source.source_path, source.preview)}
              role={onSourceClick ? 'button' : undefined}
              tabIndex={onSourceClick ? 0 : undefined}
            >
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
              {onSourceClick && (
                <span className="source-card-view-hint">Click to view in document</span>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
