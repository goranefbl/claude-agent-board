import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import StreamingIndicator from './StreamingIndicator';
import ChatInput from './ChatInput';
import type { Message, PermissionMode } from '../../../../shared/types';

interface ToolActivity {
  type: 'use' | 'result';
  tool: string;
  input?: Record<string, unknown>;
  result?: string;
}

interface Props {
  messages: Message[];
  streaming: boolean;
  streamContent: string;
  toolActivities: ToolActivity[];
  error: string | null;
  lastCost: number | null;
  onSend: (content: string, images?: string[], model?: string, thinking?: boolean, mode?: PermissionMode) => void;
  onStop: () => void;
  hasSession: boolean;
  defaultModel?: string;
  defaultThinking?: boolean;
  defaultMode?: PermissionMode;
  sessionId?: string | null;
}

export default function ChatView({
  messages, streaming, streamContent, toolActivities, error, lastCost,
  onSend, onStop, hasSession, defaultModel, defaultThinking, defaultMode, sessionId,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamContent, toolActivities]);

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {!hasSession && (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Select or create a session to start chatting
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {streaming && (
            <StreamingIndicator content={streamContent} toolActivities={toolActivities} />
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}
          {lastCost !== null && !streaming && (
            <div className="text-center text-xs text-gray-600 mb-2">
              Cost: ${lastCost.toFixed(4)}
            </div>
          )}
        </div>
      </div>
      <ChatInput onSend={onSend} onStop={onStop} streaming={streaming} disabled={!hasSession} defaultModel={defaultModel} defaultThinking={defaultThinking} defaultMode={defaultMode} sessionId={sessionId} />
    </div>
  );
}
