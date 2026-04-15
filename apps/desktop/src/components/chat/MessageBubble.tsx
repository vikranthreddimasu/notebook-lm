import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = !isUser && message.content.startsWith('Error: ');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`message-bubble ${isUser ? 'message-bubble-user' : 'message-bubble-assistant'}`}>
      {message.content ? (
        <>
          <ReactMarkdown className={`message-body markdown ${isError ? 'message-error' : ''}`}>
            {message.content}
          </ReactMarkdown>
          {!isUser && !isError && (
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
