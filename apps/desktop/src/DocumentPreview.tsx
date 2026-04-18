import { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './DocumentPreview.css';

// Structural subset of the PDFDocumentProxy shape we actually use. Avoids
// react-pdf's bundled pdfjs-dist type-identity skew with top-level pdfjs-dist.
interface LoadedPdf {
  numPages: number;
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: Array<{ str?: string } | unknown> }>;
  }>;
}

// Local worker — keeps this offline-first.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface DocumentPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string;
  filename: string;
  highlightText?: string | null;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function DocumentPreview({ isOpen, onClose, documentUrl, filename, highlightText }: DocumentPreviewProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.2);
  const [showAllPages, setShowAllPages] = useState(false);
  const [highlightPageFound, setHighlightPageFound] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const isPdf = filename.toLowerCase().endsWith('.pdf');

  // Tight search target — first 60 chars of the normalized snippet.
  const searchSnippet = highlightText ? normalizeText(highlightText).slice(0, 60) : null;

  // Re-focus the overlay when a new preview opens so keyboard shortcuts work
  // without a click-to-focus step.
  useEffect(() => {
    if (isOpen) {
      setPageNumber(1);
      setLoading(true);
      setError(null);
      setHighlightPageFound(false);
      const id = requestAnimationFrame(() => overlayRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen, documentUrl]);

  // Use the react-pdf-loaded proxy (passed to onLoadSuccess) for the text
  // search instead of loading the PDF a second time via pdfjs.getDocument.
  const onDocumentLoadSuccess = useCallback(
    async (pdfLike: { numPages: number }) => {
      const pdf = pdfLike as unknown as LoadedPdf;
      const np = pdf.numPages;
      setNumPages(np);
      setLoading(false);
      setError(null);

      if (!searchSnippet || !isPdf) return;
      try {
        for (let i = 1; i <= np; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = normalizeText(
            textContent.items
              .map((item) =>
                typeof item === 'object' && item && 'str' in item && typeof (item as { str?: unknown }).str === 'string'
                  ? (item as { str: string }).str
                  : '',
              )
              .join(' '),
          );
          if (pageText.includes(searchSnippet)) {
            setPageNumber(i);
            setHighlightPageFound(true);
            setShowAllPages(false);
            return;
          }
        }
      } catch {
        // Search failed — leave viewer on page 1.
      }
    },
    [searchSnippet, isPdf],
  );

  const onDocumentLoadError = (error: Error) => {
    setError(`Failed to load document: ${error.message}`);
    setLoading(false);
  };

  const goToPrevPage = () => setPageNumber((prev) => Math.max(1, prev - 1));
  const goToNextPage = () => setPageNumber((prev) => Math.min(numPages || 1, prev + 1));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowLeft') goToPrevPage();
    else if (e.key === 'ArrowRight') goToNextPage();
    else if (e.key === '+' || e.key === '=') setScale((prev) => Math.min(3, prev + 0.1));
    else if (e.key === '-') setScale((prev) => Math.max(0.5, prev - 0.1));
  };

  /**
   * Highlight text renderer. Uses the longest-contiguous-word-run match so
   * unrelated paragraphs don't get painted amber. Threshold is "this item
   * contains a run of at least N consecutive snippet words."
   */
  const customTextRenderer = useCallback(
    (textItem: { str: string }) => {
      if (!searchSnippet) return textItem.str;
      const normalizedItem = normalizeText(textItem.str);
      if (!normalizedItem) return textItem.str;

      const snippetWords = searchSnippet.split(' ').filter((w) => w.length > 2);
      if (snippetWords.length === 0) return textItem.str;

      // Find the longest run of consecutive snippet words present in this item.
      let bestRun = 0;
      let current = 0;
      for (const w of snippetWords) {
        if (normalizedItem.includes(w)) {
          current += 1;
          bestRun = Math.max(bestRun, current);
        } else {
          current = 0;
        }
      }

      const minRun = Math.min(4, Math.max(2, Math.floor(snippetWords.length * 0.6)));
      if (bestRun >= minRun) {
        return `<mark class="pdf-highlight">${textItem.str}</mark>`;
      }
      return textItem.str;
    },
    [searchSnippet],
  );

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="document-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${filename}`}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="document-preview-container" onClick={(e) => e.stopPropagation()}>
        <div className="document-preview-header">
          <h3 className="document-preview-title">{filename}</h3>
          {highlightText && highlightPageFound && (
            <span className="preview-highlight-badge">Source found on page {pageNumber}</span>
          )}
          <div className="document-preview-controls">
            {isPdf && numPages && (
              <>
                <div className="document-preview-pagination" role="group" aria-label="Page navigation">
                  <button
                    type="button"
                    className="preview-nav-button"
                    onClick={goToPrevPage}
                    disabled={pageNumber <= 1 || showAllPages}
                    aria-label="Previous page"
                  >
                    ←
                  </button>
                  <span className="preview-page-info">
                    {showAllPages ? 'All pages' : `${pageNumber} / ${numPages}`}
                  </span>
                  <button
                    type="button"
                    className="preview-nav-button"
                    onClick={goToNextPage}
                    disabled={pageNumber >= numPages || showAllPages}
                    aria-label="Next page"
                  >
                    →
                  </button>
                </div>
                <button
                  type="button"
                  className="preview-view-toggle"
                  onClick={() => setShowAllPages(!showAllPages)}
                  aria-label={showAllPages ? 'Show single page' : 'Show all pages'}
                >
                  {showAllPages ? 'Single' : 'All pages'}
                </button>
              </>
            )}
            {isPdf && (
              <div className="document-preview-zoom" role="group" aria-label="Zoom">
                <button
                  type="button"
                  className="preview-zoom-button"
                  onClick={() => setScale((prev) => Math.max(0.5, prev - 0.1))}
                  aria-label="Zoom out"
                >
                  −
                </button>
                <span className="preview-zoom-info">{Math.round(scale * 100)}%</span>
                <button
                  type="button"
                  className="preview-zoom-button"
                  onClick={() => setScale((prev) => Math.min(3, prev + 0.1))}
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
            )}
            <button
              type="button"
              className="preview-close-button"
              onClick={onClose}
              aria-label="Close preview"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="document-preview-content">
          {loading && <div className="preview-loading">Loading&hellip;</div>}
          {error && <div className="preview-error">{error}</div>}
          {!error && isPdf && (
            <Document
              file={documentUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<div className="preview-loading">Loading&hellip;</div>}
            >
              {showAllPages && numPages ? (
                <div className="preview-pages-container">
                  {Array.from({ length: numPages }, (_, index) => (
                    <Page
                      key={index + 1}
                      pageNumber={index + 1}
                      scale={scale}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      className="preview-pdf-page"
                      customTextRenderer={searchSnippet ? customTextRenderer : undefined}
                    />
                  ))}
                </div>
              ) : (
                <div className="preview-single-page-container">
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className="preview-pdf-page"
                    customTextRenderer={searchSnippet ? customTextRenderer : undefined}
                  />
                </div>
              )}
            </Document>
          )}
          {!error && !isPdf && (
            <iframe
              src={documentUrl}
              className="preview-iframe"
              title={filename}
              onLoad={() => setLoading(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentPreview;
