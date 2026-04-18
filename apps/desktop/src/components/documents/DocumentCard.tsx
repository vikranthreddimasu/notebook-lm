import type { DocumentInfo } from '../../types';
import './documents.css';

interface DocumentCardProps {
  document: DocumentInfo;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Click handler for the explicit overflow-menu button. Separate from
   *  onContextMenu so a left-click on the "..." button doesn't also open
   *  the document preview. */
  onMenuClick?: (e: React.MouseEvent) => void;
}

const FILETYPE_LABEL: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word',
  md: 'Markdown',
  txt: 'Text',
  pptx: 'Slides',
  py: 'Python',
};

export function DocumentCard({ document, onClick, onContextMenu, onMenuClick }: DocumentCardProps) {
  const ext = document.filename.split('.').pop()?.toLowerCase() ?? '';
  const label = FILETYPE_LABEL[ext] ?? ext.toUpperCase();

  return (
    <div
      className="document-card"
      onClick={onClick}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="document-card-icon">{ext.toUpperCase()}</div>
      <div className="document-card-info">
        <span className="document-card-name" title={document.filename}>
          {document.filename}
        </span>
        <span className="document-card-meta">{label}</span>
      </div>
      {onMenuClick && (
        <button
          type="button"
          className="document-card-menu-btn"
          aria-label="Document actions"
          onClick={(e) => {
            e.stopPropagation();
            onMenuClick(e);
          }}
        >
          …
        </button>
      )}
    </div>
  );
}
