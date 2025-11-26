import { useState, useRef, useEffect } from 'react';
import { apiService } from '../services/api';
import type { ChatMessage, CoachWindow } from '../types';

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
    <div className="flex flex-col h-full rounded-2xl border border-white/10 bg-white/5 shadow-lg backdrop-blur">
      {/* Header */}
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--laser-cyan)]/20">
            <svg className="w-6 h-6 text-[var(--laser-cyan)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--ci-white)]">AI Coach Assistant</h3>
            <p className="text-xs text-[var(--ci-muted)]">
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
                  ? 'bg-[var(--laser-cyan)] text-[#001024]'
                  : 'bg-black/30 text-[var(--ci-white)] border border-white/10'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-black/30 rounded-lg px-4 py-2 border border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[var(--laser-cyan)] rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-[var(--laser-cyan)] rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-[var(--laser-cyan)] rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-[var(--ci-muted)] mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => setInput(question)}
                className="text-xs px-3 py-1 rounded-full bg-black/30 text-[var(--ci-muted)] border border-white/10 hover:border-[var(--laser-cyan)] hover:text-[var(--laser-cyan)] transition"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/10 p-4">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your roster..."
            rows={2}
            className="flex-1 resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-[var(--ci-white)] placeholder-[var(--ci-muted)] focus:border-[var(--laser-cyan)] focus:outline-none"
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="self-end rounded-lg bg-[var(--laser-cyan)] px-4 py-2 text-sm font-semibold text-[#001024] transition hover:bg-[#6ef7ff] disabled:cursor-not-allowed disabled:bg-[var(--glass-fill)] disabled:text-[var(--ci-muted)]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-[var(--ci-muted)] mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
