import type { DocumentInfo } from '../../types';
import './documents.css';

const TYPE_COLORS: Record<string, string> = {
  pdf: '#ef4444',
  docx: '#3b82f6',
  txt: '#6b7280',
  md: '#8b5cf6',
  pptx: '#f97316',
  py: '#22c55e',
};

interface DocumentCardProps {
  document: DocumentInfo;
  onClick?: () => void;
}

export function DocumentCard({ document, onClick }: DocumentCardProps) {
  const ext = document.filename.split('.').pop()?.toLowerCase() ?? '';
  const color = TYPE_COLORS[ext] ?? '#6b7280';

  return (
    <div className="document-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="document-card-icon" style={{ color }}>
        {ext.toUpperCase()}
      </div>
      <div className="document-card-info">
        <span className="document-card-name" title={document.filename}>
          {document.filename}
        </span>
        <span className="document-card-meta">
          {ext === 'pdf' ? 'PDF' : ext === 'docx' ? 'Word' : ext === 'md' ? 'Markdown' : ext === 'txt' ? 'Text' : ext === 'pptx' ? 'Slides' : ext === 'py' ? 'Python' : ext.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
