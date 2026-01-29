// ---- DB Row Types ----

export interface Project {
  id: string;
  name: string;
  description: string;
  path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  name: string;
  system_prompt: string;
  icon: string;
  is_default: number;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  prompt: string;
  is_global: number;
  scope: 'global' | 'project';
  project_id: string | null;
  source_url: string | null;
  icon: string;
  globs: string | null; // JSON array string
  created_at: string;
  updated_at: string;
}

export type SessionStatus = 'backlog' | 'in_progress' | 'review' | 'done';

export interface Session {
  id: string;
  project_id: string;
  agent_id: string;
  title: string;
  status: SessionStatus;
  status_updated_at: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  session_id: string;
  action: string;
  actor: 'user' | 'ai';
  from_status: SessionStatus | null;
  to_status: SessionStatus | null;
  created_at: string;
  // joined fields
  session_title?: string;
  project_name?: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_use?: string; // JSON string of tool interactions
  created_at: string;
}

export interface Memory {
  id: string;
  session_id: string;
  summary: string;
  pinned_facts: string; // JSON array of strings
  created_at: string;
  updated_at: string;
}

export interface SessionSkill {
  session_id: string;
  skill_id: string;
  enabled: number;
}

// ---- WebSocket Message Envelopes ----

export interface WsSendMessage {
  type: 'chat:send';
  sessionId: string;
  content: string;
}

export interface WsStopMessage {
  type: 'chat:stop';
  sessionId: string;
}

export interface WsChunkMessage {
  type: 'chat:chunk';
  sessionId: string;
  content: string;
}

export interface WsToolUseMessage {
  type: 'chat:tool_use';
  sessionId: string;
  tool: string;
  input: Record<string, unknown>;
}

export interface WsToolResultMessage {
  type: 'chat:tool_result';
  sessionId: string;
  tool: string;
  result: string;
}

export interface WsDoneMessage {
  type: 'chat:done';
  sessionId: string;
  messageId: string;
  cost?: number;
}

export interface WsErrorMessage {
  type: 'chat:error';
  sessionId: string;
  error: string;
}

export type WsClientMessage = WsSendMessage | WsStopMessage;
export type WsServerMessage =
  | WsChunkMessage
  | WsToolUseMessage
  | WsToolResultMessage
  | WsDoneMessage
  | WsErrorMessage;
