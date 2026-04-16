import { useAppStore } from '../../store/app-store';
import './layout.css';

function relevanceColor(score: number): string {
  if (score > 70) return '#7c9a82'; // sage green
  if (score >= 40) return '#fbbf24'; // amber
  return '#a8a29e'; // muted gray
}

export function SourcePanel() {
  const activeSources = useAppStore((s) => s.activeSources);

  if (activeSources.length === 0) return null;

  return (
    <aside className="source-panel">
      <div className="source-panel-header">
        <h3>Sources</h3>
        <span className="source-panel-count">{activeSources.length}</span>
      </div>

      <div className="source-panel-list">
        {activeSources.map((source, i) => (
          <div key={`${source.source_path}-${i}`} className="source-card">
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
        ))}
      </div>
    </aside>
  );
}
