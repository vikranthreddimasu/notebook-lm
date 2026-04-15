import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { useChat } from '../../hooks/useChat';
import { exportConversation } from '../../api';
import { MessageBubble } from './MessageBubble';
import { QuickChips } from './QuickChips';
import { OverflowMenu } from '../ui/OverflowMenu';
import './chat.css';

const EMPTY_CHIPS = [
  'Summarize this document',
  'What are the key takeaways?',
  'Explain this simply',
];

const FOLLOWUP_CHIPS = [
  'Tell me more',
  'Simplify this',
];

export function ChatView() {
  const { messages, isStreaming, send, clearChat } = useChat();
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);
  const notebooks = useAppStore((s) => s.notebooks);
  const toggleSourcePanel = useAppStore((s) => s.toggleSourcePanel);
  const status = useAppStore((s) => s.status);

  const activeNotebook = notebooks.find((nb) => nb.notebook_id === activeNotebookId) ?? null;

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming && status === 'ready') {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isStreaming, status]);

  const handleExport = async () => {
    try {
      await exportConversation('Notebook LM Conversation', messages);
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === '/') {
        e.preventDefault();
        toggleSourcePanel();
      }
      if (e.metaKey && e.shiftKey && e.key === 'e') {
        e.preventDefault();
        if (messages.length > 0) handleExport();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSourcePanel, messages]);

  const handleSend = (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg || isStreaming) return;
    send(msg);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const overflowItems = [
    { label: 'Export conversation', onClick: handleExport, disabled: messages.length === 0 },
    { label: 'Toggle sources', onClick: toggleSourcePanel },
    { label: 'Clear chat', onClick: clearChat, disabled: messages.length === 0 },
  ];

  const lastIsAssistant = messages.length > 0 && messages[messages.length - 1].role === 'assistant';

  return (
    <div className="chat-view">
      <div className="chat-header">
        <div className="chat-header-title">
          <h2>{activeNotebook ? activeNotebook.title : 'Notebook LM'}</h2>
        </div>
        <div className="chat-header-actions">
          <OverflowMenu items={overflowItems} />
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>What would you like to know?</p>
            <QuickChips chips={EMPTY_CHIPS} onSelect={handleSend} />
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {lastIsAssistant && !isStreaming && (
          <QuickChips chips={FOLLOWUP_CHIPS} onSelect={handleSend} />
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          rows={2}
          disabled={isStreaming || status !== 'ready'}
        />
        <button
          type="button"
          className="chat-send-btn"
          onClick={() => handleSend()}
          disabled={!input.trim() || isStreaming || status !== 'ready'}
        >
          {isStreaming ? '...' : '↑'}
        </button>
      </div>
    </div>
  );
}
