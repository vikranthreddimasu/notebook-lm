import { useRef, useState } from 'react';
import './documents.css';

interface DropZoneProps {
  onDrop: (files: FileList) => void;
  isUploading: boolean;
}

export function DropZone({ onDrop, isUploading }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      onDrop(e.dataTransfer.files);
    }
  };

  const handleClick = () => fileInputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onDrop(e.target.files);
      e.target.value = '';
    }
  };

  const className = [
    'drop-zone',
    isDragging && 'drop-zone-active',
    isUploading && 'drop-zone-uploading',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.pptx,.txt,.md,.py"
        multiple
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      {isUploading ? 'Processing...' : 'Drop files here or click to upload'}
    </div>
  );
}
