import React, { useState, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';

interface Props {
  onSend: (content: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled: boolean;
}

export default function ChatInput({ onSend, onStop, streaming, disabled }: Props) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!streaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [streaming]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  }, [input]);

  return (
    <div className="border-t border-gray-800/50 p-4 bg-[#161b22]">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select a session to start chatting...' : 'Type a message... (Enter to send, Shift+Enter for new line)'}
          disabled={disabled || streaming}
          rows={1}
          className="flex-1 resize-none bg-[#0d1117] border border-gray-700/50 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
        />
        {streaming ? (
          <button
            onClick={onStop}
            className="p-3 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
            title="Stop"
          >
            <Square size={18} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            className="p-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-white transition-colors"
            title="Send"
          >
            <Send size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
