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

export function ChatView({ pendingSuggest, onSuggestConsumed }: { pendingSuggest?: string | null; onSuggestConsumed?: () => void } = {}) {
  const { messages, isStreaming, send, clearChat, abort } = useChat();
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);
  const notebooks = useAppStore((s) => s.notebooks);
  const toggleSourcePanel = useAppStore((s) => s.toggleSourcePanel);
  const status = useAppStore((s) => s.status);

  const activeNotebook = notebooks.find((nb) => nb.notebook_id === activeNotebookId) ?? null;

  const [input, setInput] = useState('');
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  // Post-wizard auto-populate
  useEffect(() => {
    if (pendingSuggest && !input && messages.length === 0) {
      setInput(pendingSuggest);
      onSuggestConsumed?.();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [pendingSuggest]);
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

  useEffect(() => {
    const el = messagesEndRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsScrolledUp(!entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleExport = async () => {
    try {
      await exportConversation('Notebook LM Conversation', messages);
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  // Keyboard shortcuts moved to AppShell (global handler)

  const handleInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const handleSend = (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg || isStreaming) return;
    send(msg);
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
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
          {activeNotebook && (
            <span className="chat-header-meta">
              {activeNotebook.source_count} {activeNotebook.source_count === 1 ? 'doc' : 'docs'}
            </span>
          )}
        </div>
        <div className="chat-header-actions">
          {messages.length > 0 && (
            <button type="button" className="chat-header-btn" onClick={clearChat}>
              New chat
            </button>
          )}
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
          <MessageBubble
            key={i}
            message={msg}
            onRetry={
              msg.role === 'assistant' && msg.content.startsWith('Error: ')
                ? () => {
                    // Find the user message above this error
                    const userMsg = messages[i - 1];
                    if (userMsg?.role === 'user') {
                      // Remove error + user message, re-send
                      const store = useAppStore.getState();
                      const newMessages = messages.slice(0, i - 1);
                      // We can't directly set messages in store, so clear and re-add
                      store.clearMessages();
                      newMessages.forEach((m) => store.addMessage(m));
                      send(userMsg.content);
                    }
                  }
                : undefined
            }
          />
        ))}
        {lastIsAssistant && !isStreaming && (
          <QuickChips chips={FOLLOWUP_CHIPS} onSelect={handleSend} />
        )}
        <div ref={messagesEndRef} />
      </div>

      {isScrolledUp && messages.length > 0 && (
        <button type="button" className="scroll-to-bottom" onClick={scrollToBottom}>
          ↓
        </button>
      )}

      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Ask anything..."
          disabled={isStreaming || status !== 'ready'}
        />
        <button
          type="button"
          className={`chat-send-btn ${isStreaming ? 'chat-stop-btn' : ''}`}
          onClick={() => isStreaming ? abort() : handleSend()}
          disabled={!isStreaming && (!input.trim() || status !== 'ready')}
        >
          {isStreaming ? '■' : '↑'}
        </button>
      </div>
    </div>
  );
}
