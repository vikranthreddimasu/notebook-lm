import type { SourceChunk } from '../types';

function sanitizeKey(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 20)
    .toLowerCase() || 'source';
}

function extractYear(path: string): string {
  const match = path.match(/(19|20)\d{2}/);
  return match ? match[0] : new Date().getFullYear().toString();
}

function extractAuthor(filename: string): string {
  // Try to extract author from common patterns: "Author - Title.pdf", "Author_Title.pdf"
  const cleaned = filename.replace(/\.[^.]+$/, ''); // remove extension
  const parts = cleaned.split(/\s*[-_]\s*/);
  if (parts.length >= 2) {
    return parts[0].trim();
  }
  return cleaned.trim();
}

export function sourcesToBibtex(sources: SourceChunk[]): string {
  // Deduplicate by source_path
  const seen = new Set<string>();
  const unique = sources.filter((s) => {
    if (seen.has(s.source_path)) return false;
    seen.add(s.source_path);
    return true;
  });

  const entries = unique.map((source, i) => {
    const filename = source.document_name || source.source_path.split(/[/\\]/).pop() || 'document';
    const title = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
    const author = extractAuthor(filename);
    const year = extractYear(source.source_path);
    const key = `${sanitizeKey(author)}${year}_${i + 1}`;

    return [
      `@misc{${key},`,
      `  title = {${title}},`,
      `  author = {${author}},`,
      `  year = {${year}},`,
      `  note = {Retrieved via Notebook LM. Passage: "${source.preview.slice(0, 100).replace(/"/g, "'")}..."},`,
      `  howpublished = {Local file: ${source.source_path}}`,
      `}`,
    ].join('\n');
  });

  return entries.join('\n\n') + '\n';
}

export function downloadBibtex(sources: SourceChunk[], conversationTitle?: string): void {
  const bibtex = sourcesToBibtex(sources);
  const blob = new Blob([bibtex], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const name = (conversationTitle || 'notebook-lm-sources').replace(/\s+/g, '_');
  link.download = `${name}.bib`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
