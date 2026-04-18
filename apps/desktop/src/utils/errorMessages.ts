/**
 * Translate raw backend / network errors into sentences a human actually
 * wants to read. Uses the original error as a fallback so we never obscure
 * unknown failures — just reframe the ones we recognise.
 */

interface ErrorContext {
  /** Short hint about what the user was doing — shown in the message.
   *  E.g. "upload", "delete", "rename". */
  action?: string;
}

const KNOWN_PATTERNS: Array<{ test: (msg: string) => boolean; render: (ctx: ErrorContext) => string }> = [
  {
    test: (m) => /ECONNREFUSED|Failed to fetch|NetworkError|Network request failed/i.test(m),
    render: (ctx) =>
      ctx.action
        ? `The backend isn't reachable, so we couldn't ${ctx.action}. Check that the server is running.`
        : "The backend isn't reachable. Check that the server is running.",
  },
  {
    test: (m) => /timed? out|ETIMEDOUT/i.test(m),
    render: (ctx) =>
      ctx.action
        ? `The ${ctx.action} request took too long and was stopped. Try again in a moment.`
        : 'The request took too long and was stopped.',
  },
  {
    test: (m) => /status 413|payload too large|Request Entity Too Large/i.test(m),
    render: () => "That file is too large. Split it into smaller documents and try again.",
  },
  {
    test: (m) => /status 415|Unsupported Media Type|unsupported file/i.test(m),
    render: () => "That file type isn't supported. Try a PDF, DOCX, PPTX, TXT, or Markdown file.",
  },
  {
    test: (m) => /status 422|Unprocessable Entity/i.test(m),
    render: () => "We couldn't process that. The file may be empty, scanned without OCR, or corrupt.",
  },
  {
    test: (m) => /status 403|Access denied|Forbidden/i.test(m),
    render: () => "That file is outside this notebook.",
  },
  {
    test: (m) => /status 404|Not Found/i.test(m),
    render: (ctx) =>
      ctx.action ? `Couldn't find what we needed to ${ctx.action}.` : "Not found.",
  },
  {
    test: (m) => /status 500|Internal Server Error/i.test(m),
    render: (ctx) =>
      ctx.action
        ? `Something went wrong on the server while trying to ${ctx.action}.`
        : 'Something went wrong on the server.',
  },
  {
    test: (m) => /Ollama|ollama|model not found/i.test(m),
    render: () =>
      "The AI model isn't available. Make sure Ollama is running and the model is installed.",
  },
];

/** Produce a single-line user-facing message for a caught error. */
export function humanizeError(err: unknown, context: ErrorContext = {}): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : 'Unknown error';

  for (const { test, render } of KNOWN_PATTERNS) {
    if (test(raw)) return render(context);
  }
  // Fallback: drop any FastAPI-style JSON detail wrapper and cap length.
  const jsonMatch = raw.match(/"detail"\s*:\s*"([^"]+)"/);
  if (jsonMatch) return jsonMatch[1];
  return raw.length > 140 ? raw.slice(0, 140) + '…' : raw;
}
