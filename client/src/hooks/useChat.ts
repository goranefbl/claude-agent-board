import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/http';
import { wsClient } from '../api/ws';
import type { Message, WsServerMessage, PermissionMode } from '../../../shared/types';

interface ToolActivity {
  type: 'use' | 'result';
  tool: string;
  input?: Record<string, unknown>;
  result?: string;
}

// Track streaming state per session so background sessions keep working
const streamingSessionIds = new Set<string>();

export function useChat(sessionId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [toolActivities, setToolActivities] = useState<ToolActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastCost, setLastCost] = useState<number | null>(null);
  const streamRef = useRef('');
  const sessionRef = useRef(sessionId);

  // Keep sessionRef in sync
  sessionRef.current = sessionId;

  // Load messages when session changes and reset UI state
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setStreaming(false);
      setStreamContent('');
      setToolActivities([]);
      setError(null);
      streamRef.current = '';
      return;
    }
    // Check if this session is already streaming (switched back to it)
    setStreaming(streamingSessionIds.has(sessionId));
    setStreamContent('');
    setToolActivities([]);
    setError(null);
    streamRef.current = '';
    api.get<Message[]>(`/sessions/${sessionId}/messages`).then(setMessages);
  }, [sessionId]);

  // Connect WS
  useEffect(() => {
    wsClient.connect();
  }, []);

  // Subscribe to WS messages — process for current session only
  useEffect(() => {
    if (!sessionId) return;

    const unsub = wsClient.subscribe((msg: WsServerMessage) => {
      // Always track done/error for any session (cleanup global tracking)
      if (msg.type === 'chat:done' || msg.type === 'chat:error') {
        streamingSessionIds.delete(msg.sessionId);
      }

      // Only update UI for the currently viewed session
      if (msg.sessionId !== sessionId) return;

      if (msg.type === 'chat:chunk') {
        streamRef.current += msg.content;
        setStreamContent(streamRef.current);
      } else if (msg.type === 'chat:tool_use') {
        setToolActivities(prev => [...prev, { type: 'use', tool: msg.tool, input: msg.input }]);
      } else if (msg.type === 'chat:tool_result') {
        setToolActivities(prev => [...prev, { type: 'result', tool: msg.tool, result: msg.result }]);
      } else if (msg.type === 'chat:done') {
        setStreaming(false);
        setLastCost(msg.cost ?? null);
        api.get<Message[]>(`/sessions/${sessionId}/messages`).then(setMessages);
        streamRef.current = '';
        setStreamContent('');
        setToolActivities([]);
      } else if (msg.type === 'chat:error') {
        setStreaming(false);
        setError(msg.error);
        streamRef.current = '';
        setStreamContent('');
        setToolActivities([]);
      }
    });

    return unsub;
  }, [sessionId]);

  const send = useCallback((content: string, images?: string[], model?: string, thinking?: boolean, mode?: PermissionMode) => {
    if (!sessionId || streaming) return;
    setError(null);
    setStreaming(true);
    setLastCost(null);
    streamRef.current = '';
    setStreamContent('');
    setToolActivities([]);
    streamingSessionIds.add(sessionId);

    const optimistic: Message = {
      id: 'temp-' + Date.now(),
      session_id: sessionId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    wsClient.send({ type: 'chat:send', sessionId, content, images, model, thinking, mode });
  }, [sessionId, streaming]);

  const stop = useCallback(() => {
    if (!sessionId) return;
    wsClient.send({ type: 'chat:stop', sessionId });
    setStreaming(false);
    streamingSessionIds.delete(sessionId);
  }, [sessionId]);

  return { messages, streaming, streamContent, toolActivities, error, lastCost, send, stop };
}
