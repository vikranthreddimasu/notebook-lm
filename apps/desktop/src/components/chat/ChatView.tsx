// apps/desktop/src/components/chat/ChatView.tsx
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { useChat } from '../../hooks/useChat';
import { exportConversation } from '../../api';
import { MessageBubble } from './MessageBubble';
import './chat.css';

export function ChatView() {
  const { messages, isStreaming, send } = useChat();
  const config = useAppStore((s) => s.config);
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);
  const sourcePanelOpen = useAppStore((s) => s.sourcePanelOpen);
  const toggleSourcePanel = useAppStore((s) => s.toggleSourcePanel);
  const status = useAppStore((s) => s.status);

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

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+/ — toggle source panel
      if (e.metaKey && e.key === '/') {
        e.preventDefault();
        toggleSourcePanel();
      }
      // Cmd+Shift+E — export
      if (e.metaKey && e.shiftKey && e.key === 'e') {
        e.preventDefault();
        if (messages.length > 0) handleExport();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSourcePanel, messages]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    send(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-view">
      <div className="chat-header">
        <h2>{activeNotebookId ? 'Chat' : 'Notebook LM'}</h2>
        <div className="chat-header-actions">
          <button
            type="button"
            className="chat-header-btn"
            onClick={handleExport}
            disabled={messages.length === 0}
          >
            Export
          </button>
          <button type="button" className="chat-header-btn" onClick={toggleSourcePanel}>
            {sourcePanelOpen ? 'Hide Sources' : 'Show Sources'}
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Start a conversation with your documents</p>
            {config && (
              <p className="chat-empty-hint">
                Using {config.resolved_ollama_model ?? config.ollama_model} via{' '}
                {config.llm_provider}
              </p>
            )}
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your documents... (Enter to send, Shift+Enter for new line)"
          rows={3}
          disabled={isStreaming || status !== 'ready'}
        />
        <button
          type="button"
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || isStreaming || status !== 'ready'}
        >
          {isStreaming ? 'Thinking...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
