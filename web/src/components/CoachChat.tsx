import { useState, useRef, useEffect } from 'react';
import { apiService } from '../services/api';
import type { ChatMessage, CoachWindow } from '../types';
import { MessageCircle, Send } from 'lucide-react';

interface CoachChatProps {
  window?: CoachWindow;
  contextReady: boolean;
}

export function CoachChat({ window, contextReady }: CoachChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial greeting message
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = contextReady
        ? "Hi! I'm your AI fantasy hockey coach. Ask me anything about your recommendations, player schedules, or strategies!"
        : "Hi! I'm your AI fantasy hockey coach. To get started, upload your league settings and roster above. I'll help you optimize your lineup!";

      setMessages([{
        role: 'assistant',
        content: greeting,
        timestamp: Date.now()
      }]);
    }
  }, [contextReady, messages.length]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    // Create placeholder assistant message
    const assistantMessageIndex = messages.length + 1;
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }]);

    try {
      let fullResponse = '';

      for await (const chunk of apiService.streamChatMessage(userMessage.content, window)) {
        fullResponse += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[assistantMessageIndex] = {
            role: 'assistant',
            content: fullResponse,
            timestamp: Date.now()
          };
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[assistantMessageIndex] = {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again or check that the backend is running.',
          timestamp: Date.now()
        };
        return newMessages;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = contextReady
    ? [
        "Why should I drop this player?",
        "Who has the best off-night schedule?",
        "Show me players with back-to-backs"
      ]
    : [
        "How do I upload my league settings?",
        "What information do you need?",
        "How does the AI coach work?"
      ];

  return (
    <div className="flex flex-col h-full rounded-2xl border border-line bg-surface-1/5 shadow-lg backdrop-blur">
      {/* Header */}
      <div className="border-b border-line p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/20">
            <MessageCircle className="w-6 h-6 text-accent" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--ink)]">AI Coach Assistant</h3>
            <p className="text-xs text-[var(--ink-mute)]">
              {contextReady ? 'Ready to help optimize your lineup' : 'Upload your data to get started'}
            </p>
          </div>
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-[var(--accent)] text-accent-ink'
                  : 'bg-surface-glass text-[var(--ink)] border border-line'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-surface-glass rounded-lg px-4 py-2 border border-line">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse"></div>
                <div
                  className='w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse [animation-delay:0.2s]'></div>
                <div
                  className='w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse [animation-delay:0.4s]'></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Suggested Questions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-[var(--ink-mute)] mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => setInput(question)}
                className="text-xs px-3 py-1 rounded-full bg-surface-glass text-[var(--ink-mute)] border border-line hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Input */}
      <div className="border-t border-line p-4">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your roster..."
            rows={2}
            className="flex-1 resize-none rounded-lg border border-line bg-surface-glass px-3 py-2 text-sm text-[var(--ink)] placeholder-[var(--ink-mute)] focus:border-[var(--accent)] focus:outline-none"
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="self-end rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-[var(--surface-glass)] disabled:text-[var(--ink-mute)]"
          >
            <Send className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <p className="text-xs text-[var(--ink-mute)] mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
