import React from 'react';
import { useAgents } from '../hooks/useAgents';
import Sidebar from '../components/layout/Sidebar';
import AgentManager from '../components/agents/AgentManager';

export default function AgentsPage() {
  const { agents, create, update, remove } = useAgents();

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1117]">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <AgentManager agents={agents} onCreate={create} onUpdate={update} onDelete={remove} />
      </div>
    </div>
  );
}
