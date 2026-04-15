import { useAppStore } from '../../store/app-store';
import './layout.css';

export function SourcePanel() {
  const activeSources = useAppStore((s) => s.activeSources);

  if (activeSources.length === 0) return null;

  return (
    <aside className="source-panel">
      <div className="source-panel-list">
        {activeSources.map((source, i) => (
          <div key={`${source.source_path}-${i}`} className="source-card">
            <span className="source-card-name">{source.document_name}</span>
            <p className="source-card-preview">{source.preview}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
