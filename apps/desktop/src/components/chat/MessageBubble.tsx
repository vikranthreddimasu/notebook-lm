// apps/desktop/src/components/chat/MessageBubble.tsx
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`message-bubble ${isUser ? 'message-bubble-user' : 'message-bubble-assistant'}`}>
      {message.content ? (
        <ReactMarkdown className="message-body markdown">{message.content}</ReactMarkdown>
      ) : (
        <div className="thinking-indicator">
          <span className="thinking-text">thinking&hellip;</span>
        </div>
      )}
    </div>
  );
}
