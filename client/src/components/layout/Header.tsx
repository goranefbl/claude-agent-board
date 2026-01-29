import React from 'react';
import { Brain, Download, Settings } from 'lucide-react';
import type { Agent, SessionStatus } from '../../../../shared/types';

const STATUS_OPTIONS: { key: SessionStatus; label: string; color: string }[] = [
  { key: 'backlog', label: 'Backlog', color: 'bg-gray-500' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-amber-500' },
  { key: 'review', label: 'Review', color: 'bg-blue-500' },
  { key: 'done', label: 'Done', color: 'bg-emerald-500' },
];

interface Props {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
  onToggleMemory: () => void;
  onToggleSkills: () => void;
  onExport: () => void;
  sessionId: string | null;
  sessionStatus?: SessionStatus;
  onStatusChange?: (status: SessionStatus) => void;
}

export default function Header({
  agents, selectedAgentId, onSelectAgent,
  onToggleMemory, onToggleSkills, onExport, sessionId,
  sessionStatus, onStatusChange,
}: Props) {
  const currentStatus = STATUS_OPTIONS.find(s => s.key === sessionStatus) || STATUS_OPTIONS[0];

  return (
    <header className="h-12 bg-[#161b22] border-b border-gray-800/50 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        {sessionId && (
          <select
            value={selectedAgentId || ''}
            onChange={(e) => onSelectAgent(e.target.value)}
            className="text-xs bg-[#0d1117] border border-gray-700/50 rounded px-2 py-1 text-white focus:outline-none focus:border-amber-500/50"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>
        )}

        {sessionId && onStatusChange && (
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${currentStatus.color}`} />
            <select
              value={sessionStatus || 'backlog'}
              onChange={(e) => onStatusChange(e.target.value as SessionStatus)}
              className="text-xs bg-[#0d1117] border border-gray-700/50 rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-amber-500/50"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {sessionId && (
        <div className="flex items-center gap-2">
          <button onClick={onToggleSkills} className="text-gray-500 hover:text-gray-300 p-1 transition-colors" title="Skills">
            <Settings size={16} />
          </button>
          <button onClick={onToggleMemory} className="text-gray-500 hover:text-gray-300 p-1 transition-colors" title="Memory">
            <Brain size={16} />
          </button>
          <button onClick={onExport} className="text-gray-500 hover:text-gray-300 p-1 transition-colors" title="Export">
            <Download size={16} />
          </button>
        </div>
      )}
    </header>
  );
}
