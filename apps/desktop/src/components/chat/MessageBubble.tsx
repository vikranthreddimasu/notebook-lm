import { useState, Fragment, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import type { ChatMessage, SourceChunk } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
  sources?: SourceChunk[];
  onCitationClick?: (source: SourceChunk, index: number) => void;
  onCitationHover?: (index: number | null) => void;
  onRetry?: () => void;
}

// Accepts `[Source 1]`, `[Source #1]`, `[source 1]`, `[1]` — we convert them
// all into a citation marker keyed by 1-based index.
const CITATION_RE = /\[(?:source\s*#?\s*)?(\d+)\]/gi;

/**
 * Split a paragraph of text into sentences. Keeps terminators + trailing
 * whitespace. Rough, but good enough to identify which sentence is the
 * bearer of a citation.
 */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[^.!?\n]+(?:[.!?]+|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0]) out.push(m[0]);
  }
  if (out.length === 0) out.push(text);
  return out;
}

/**
 * Render the marker itself — a small mono chip sitting inside the sentence.
 * Clicking opens the source; hover previews in the side panel via callbacks.
 */
function CitationMarker({
  n,
  source,
  onClick,
  onHover,
}: {
  n: number;
  source: SourceChunk | undefined;
  onClick?: (e: React.MouseEvent) => void;
  onHover?: (hovering: boolean) => void;
}) {
  if (!source) {
    // Model hallucinated a citation index outside the source list. Still
    // render it — but styled as a quiet placeholder so we don't pretend
    // it's real.
    return (
      <sup className="cite-marker cite-marker-orphan" title="Source not found">
        [{n}]
      </sup>
    );
  }
  return (
    <sup
      className="cite-marker"
      role="button"
      tabIndex={0}
      title={source.document_name}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e as unknown as React.MouseEvent);
        }
      }}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      [{n}]
    </sup>
  );
}

/**
 * Given a string, return the rendered nodes — sentences containing a citation
 * become `.cited` blocks with an amber left-rule, citations become clickable
 * `.cite-marker` superscript chips.
 */
function renderWithCitations(
  text: string,
  sources: SourceChunk[] | undefined,
  onCitationClick: MessageBubbleProps['onCitationClick'],
  onCitationHover: MessageBubbleProps['onCitationHover'],
): ReactNode {
  if (!sources || sources.length === 0 || !CITATION_RE.test(text)) {
    CITATION_RE.lastIndex = 0;
    return text;
  }
  CITATION_RE.lastIndex = 0;

  const sentences = splitSentences(text);
  return sentences.map((sentence, sIdx) => {
    const hasCitation = /\[(?:source\s*#?\s*)?\d+\]/i.test(sentence);
    if (!hasCitation) {
      return <Fragment key={sIdx}>{sentence}</Fragment>;
    }

    // Interleave plain text + CitationMarker nodes.
    const nodes: ReactNode[] = [];
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    const re = new RegExp(CITATION_RE.source, CITATION_RE.flags);
    while ((m = re.exec(sentence)) !== null) {
      const n = parseInt(m[1]!, 10);
      const source = sources[n - 1];
      if (m.index > lastIdx) {
        nodes.push(sentence.slice(lastIdx, m.index));
      }
      nodes.push(
        <CitationMarker
          key={`${sIdx}-${m.index}`}
          n={n}
          source={source}
          onClick={
            source
              ? (e) => {
                  e.stopPropagation();
                  onCitationClick?.(source, n - 1);
                }
              : undefined
          }
          onHover={(hovering) => onCitationHover?.(hovering ? n - 1 : null)}
        />,
      );
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < sentence.length) {
      nodes.push(sentence.slice(lastIdx));
    }

    return (
      <span key={sIdx} className="cited">
        {nodes}
      </span>
    );
  });
}

/** Walk ReactMarkdown's rendered children, replacing string nodes with
 *  citation-rendered trees. Non-string children (bold, links) pass through.
 */
function processChildren(
  children: ReactNode,
  sources: SourceChunk[] | undefined,
  onCitationClick: MessageBubbleProps['onCitationClick'],
  onCitationHover: MessageBubbleProps['onCitationHover'],
): ReactNode {
  if (children == null) return children;
  if (typeof children === 'string') {
    return renderWithCitations(children, sources, onCitationClick, onCitationHover);
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <Fragment key={i}>
        {processChildren(child, sources, onCitationClick, onCitationHover)}
      </Fragment>
    ));
  }
  return children;
}

export function MessageBubble({ message, sources, onCitationClick, onCitationHover, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = !isUser && message.content.startsWith('Error: ');
  const isAborted = !isUser && message.aborted === true;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Only wire citation rendering into assistant-rendered markdown.
  const markdownComponents: Components | undefined =
    !isUser && sources && sources.length > 0
      ? {
          p: ({ children, ...rest }) => (
            <p {...rest}>{processChildren(children, sources, onCitationClick, onCitationHover)}</p>
          ),
          li: ({ children, ...rest }) => (
            <li {...rest}>{processChildren(children, sources, onCitationClick, onCitationHover)}</li>
          ),
        }
      : undefined;

  return (
    <div
      className={`message-bubble ${isUser ? 'message-bubble-user' : 'message-bubble-assistant'} ${
        isAborted ? 'message-bubble-aborted' : ''
      }`}
    >
      {message.content ? (
        <>
          <ReactMarkdown
            className={`message-body markdown ${isError ? 'message-error' : ''}`}
            components={markdownComponents}
          >
            {message.content}
          </ReactMarkdown>
          {isAborted && <span className="message-aborted-tag">stopped</span>}
          {!isUser && !isError && !isAborted && (
            <button type="button" className="message-copy-btn" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
          {isError && onRetry && (
            <button type="button" className="message-retry-btn" onClick={onRetry}>
              Retry
            </button>
          )}
        </>
      ) : (
        <div className="thinking-indicator">
          <span className="thinking-text">thinking&hellip;</span>
        </div>
      )}
    </div>
  );
}
