import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/http';
import { useProjects } from '../hooks/useProjects';
import { useSessions } from '../hooks/useSessions';
import { useChat } from '../hooks/useChat';
import { useMemory } from '../hooks/useMemory';
import { useAgents } from '../hooks/useAgents';
import { useSessionSkills } from '../hooks/useSkills';
import MainLayout from '../components/layout/MainLayout';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import ChatView from '../components/chat/ChatView';
import MemoryPanel from '../components/memory/MemoryPanel';
import SkillToggleList from '../components/skills/SkillToggleList';
import type { SessionStatus } from '../../../shared/types';

const GENERAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

export default function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectFromUrl = searchParams.get('project');
  const sessionFromUrl = searchParams.get('session');
  // null = general chat (uses GENERAL_PROJECT_ID), otherwise a real project id
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectFromUrl);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(sessionFromUrl);

  // Sync state when URL changes (e.g. clicking "Chat" nav clears the project param)
  useEffect(() => {
    if (projectFromUrl !== selectedProjectId) {
      setSelectedProjectId(projectFromUrl);
      if (!sessionFromUrl) setSelectedSessionId(null);
    }
    if (sessionFromUrl && sessionFromUrl !== selectedSessionId) {
      setSelectedSessionId(sessionFromUrl);
    }
  }, [projectFromUrl, sessionFromUrl]);
  const [showMemory, setShowMemory] = useState(false);
  const [showSkills, setShowSkills] = useState(false);

  const { projects, create: createProject, remove: removeProject } = useProjects();
  // When no project selected, show sessions for the General project
  const activeProjectId = selectedProjectId || GENERAL_PROJECT_ID;
  const { sessions, create: createSession, remove: removeSession, refresh: refreshSessions } = useSessions(activeProjectId);
  const { agents } = useAgents();
  const { messages, streaming, streamContent, toolActivities, error, lastCost, send, stop } = useChat(selectedSessionId);
  const { memory, addFact, removeFact, update: updateMemory, refresh: refreshMemory } = useMemory(selectedSessionId);
  const { skills: sessionSkills, toggle: toggleSkill } = useSessionSkills(selectedSessionId, selectedProjectId);

  // Auto-select or auto-create a session when landing on /chat
  useEffect(() => {
    if (selectedSessionId) return;
    if (agents.length === 0) return;
    if (sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
      return;
    }
    // No sessions — create one
    const defaultAgent = agents.find((a) => a.is_default) || agents[0];
    createSession(defaultAgent.id, 'New Chat').then((s) => {
      if (s) setSelectedSessionId(s.id);
    });
  }, [agents, sessions, selectedSessionId]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const selectedAgentId = selectedSession?.agent_id || null;

  const handleCreateProject = useCallback(async (name: string) => {
    const p = await createProject(name);
    setSelectedProjectId(p.id);
    setSelectedSessionId(null);
  }, [createProject]);

  const handleCreateSession = useCallback(async () => {
    if (agents.length === 0) return;
    const defaultAgent = agents.find((a) => a.is_default) || agents[0];
    const s = await createSession(defaultAgent.id);
    if (s) setSelectedSessionId(s.id);
  }, [agents, createSession]);

  const handleSelectAgent = useCallback(async (agentId: string) => {
    if (!selectedSessionId) return;
    await api.put(`/sessions/${selectedSessionId}`, { agent_id: agentId });
    refreshSessions();
  }, [selectedSessionId, refreshSessions]);

  const handleExport = useCallback(() => {
    if (!selectedSessionId) return;
    window.open(`/api/export/${selectedSessionId}`, '_blank');
  }, [selectedSessionId]);

  const handleStatusChange = useCallback(async (status: SessionStatus) => {
    if (!selectedSessionId) return;
    await api.patch(`/sessions/${selectedSessionId}/status`, { status, actor: 'user' });
    refreshSessions();
  }, [selectedSessionId, refreshSessions]);

  const handleDeleteProject = useCallback(async (id: string) => {
    await removeProject(id);
    if (selectedProjectId === id) {
      setSelectedProjectId(null);
      setSelectedSessionId(null);
    }
  }, [removeProject, selectedProjectId]);

  const handleDeleteSession = useCallback(async (id: string) => {
    await removeSession(id);
    if (selectedSessionId === id) setSelectedSessionId(null);
  }, [removeSession, selectedSessionId]);

  React.useEffect(() => {
    if (selectedSessionId && !streaming) refreshMemory();
  }, [messages.length, streaming]);

  const rightPanel = showMemory ? (
    <MemoryPanel
      memory={memory}
      onAddFact={addFact}
      onRemoveFact={removeFact}
      onUpdateSummary={(summary) => updateMemory({ summary })}
    />
  ) : showSkills ? (
    <SkillToggleList skills={sessionSkills} onToggle={toggleSkill} />
  ) : undefined;

  return (
    <MainLayout
      sidebar={
        <Sidebar
          projects={projects}
          sessions={sessions}
          selectedProjectId={selectedProjectId}
          selectedSessionId={selectedSessionId}
          onSelectProject={(id) => { setSelectedProjectId(id); setSelectedSessionId(null); setSearchParams({ project: id }); }}
          onSelectSession={setSelectedSessionId}
          onCreateProject={handleCreateProject}
          onCreateSession={handleCreateSession}
          onDeleteProject={handleDeleteProject}
          onDeleteSession={handleDeleteSession}
        />
      }
      header={
        <Header
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={handleSelectAgent}
          onToggleMemory={() => { setShowMemory(!showMemory); setShowSkills(false); }}
          onToggleSkills={() => { setShowSkills(!showSkills); setShowMemory(false); }}
          onExport={handleExport}
          sessionId={selectedSessionId}
          sessionStatus={selectedSession?.status}
          onStatusChange={handleStatusChange}
        />
      }
      rightPanel={rightPanel}
    >
      <ChatView
        messages={messages}
        streaming={streaming}
        streamContent={streamContent}
        toolActivities={toolActivities}
        error={error}
        lastCost={lastCost}
        onSend={send}
        onStop={stop}
        hasSession={!!selectedSessionId}
      />
    </MainLayout>
  );
}
