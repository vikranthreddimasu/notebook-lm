import { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/app-store';
import type { SourceChunk } from '../../types';
import './layout.css';

interface SourcePanelProps {
  onSourceClick?: (source: SourceChunk, index: number) => void;
  hoveredIndex?: number | null;
  onCardHover?: (index: number | null) => void;
}

/**
 * Map a 0–100 relevance score to a design-token color. 0–1 float scores
 * (defensive — backend sometimes emits them) are treated as 0%.
 */
function relevanceTone(score: number | undefined): string {
  if (score == null) return 'var(--color-text-muted)';
  if (score > 70) return 'var(--color-accent)';
  if (score >= 40) return 'var(--color-cite)';
  return 'var(--color-text-muted)';
}

function clampPercent(score: number | undefined): number {
  if (score == null) return 0;
  // Some backends emit 0–1 floats; treat anything ≤1 as a fraction.
  const pct = score <= 1 ? score * 100 : score;
  return Math.max(0, Math.min(100, pct));
}

export function SourcePanel({ onSourceClick, hoveredIndex, onCardHover }: SourcePanelProps) {
  const activeSources = useAppStore((s) => s.activeSources);
  const sourcePanelOpen = useAppStore((s) => s.sourcePanelOpen);
  const crossNotebookMode = useAppStore((s) => s.crossNotebookMode);
  const notebooks = useAppStore((s) => s.notebooks);
  const cardRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  // When a citation is hovered/clicked, scroll its card into view in the panel.
  useEffect(() => {
    if (hoveredIndex == null) return;
    const el = cardRefs.current.get(hoveredIndex);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [hoveredIndex]);

  if (!sourcePanelOpen) return null;

  return (
    <aside className="source-panel" aria-label="Sources">
      <div className="source-panel-header">
        <h3>Sources</h3>
        {activeSources.length > 0 && (
          <span className="source-panel-count">{activeSources.length}</span>
        )}
      </div>

      {activeSources.length === 0 ? (
        <div className="source-panel-empty">
          <p className="source-panel-empty-headline">No sources yet</p>
          <p className="source-panel-empty-hint">
            Ask a question and the excerpts that grounded the answer will appear here.
          </p>
        </div>
      ) : (
        <div className="source-panel-list">
          {activeSources.map((source, i) => {
            const nbId = source.notebook_id;
            const nbName = nbId ? notebooks.find((nb) => nb.notebook_id === nbId)?.title : null;
            const isHovered = hoveredIndex === i;
            const pct = clampPercent(source.relevance_score);

            return (
              <div
                key={`${source.source_path}-${i}`}
                ref={(el) => {
                  cardRefs.current.set(i, el);
                }}
                className={`source-card ${onSourceClick ? 'source-card-clickable' : ''} ${
                  isHovered ? 'source-card-hovered' : ''
                }`}
                onClick={() => onSourceClick?.(source, i)}
                onMouseEnter={() => onCardHover?.(i)}
                onMouseLeave={() => onCardHover?.(null)}
                role={onSourceClick ? 'button' : undefined}
                tabIndex={onSourceClick ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onSourceClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onSourceClick(source, i);
                  }
                }}
              >
                <div className="source-card-header">
                  <span className="source-card-marker">[{i + 1}]</span>
                  {crossNotebookMode && nbName && (
                    <span className="source-card-notebook">{nbName}</span>
                  )}
                </div>
                <span className="source-card-name">{source.document_name}</span>
                {source.relevance_score != null && (
                  <div
                    className="source-relevance-track"
                    aria-label={`Relevance ${Math.round(pct)}%`}
                  >
                    <div
                      className="source-relevance-bar"
                      style={{ width: `${pct}%`, backgroundColor: relevanceTone(source.relevance_score) }}
                    />
                  </div>
                )}
                <p className="source-card-preview">{source.preview}</p>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
