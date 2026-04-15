import { useEffect, useState } from 'react';
import './drag-overlay.css';

interface DragOverlayProps {
  notebookName?: string;
  onDrop: (files: FileList) => void;
}

export function DragOverlay({ notebookName, onDrop }: DragOverlayProps) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) setIsDragging(false);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);
      if (e.dataTransfer?.files.length) {
        onDrop(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onDrop]);

  if (!isDragging) return null;

  return (
    <div className="drag-overlay">
      <div className="drag-overlay-content">
        <div className="drag-overlay-icon">+</div>
        <p className="drag-overlay-text">
          {notebookName
            ? `Drop to add to "${notebookName}"`
            : 'Drop to create a new notebook'}
        </p>
      </div>
    </div>
  );
}
