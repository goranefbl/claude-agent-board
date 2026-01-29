import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import type { Agent } from '../../../../shared/types';

interface Props {
  agents: Agent[];
  onCreate: (data: { name: string; system_prompt: string; icon: string }) => void;
  onUpdate: (id: string, data: Partial<Agent>) => void;
  onDelete: (id: string) => void;
}

export default function AgentManager({ agents, onCreate, onUpdate, onDelete }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', system_prompt: '', icon: '🤖' });

  const handleCreate = () => {
    if (!form.name || !form.system_prompt) return;
    onCreate(form);
    setForm({ name: '', system_prompt: '', icon: '🤖' });
    setShowCreate(false);
  };

  const startEdit = (a: Agent) => {
    setEditingId(a.id);
    setForm({ name: a.name, system_prompt: a.system_prompt, icon: a.icon });
  };

  const handleUpdate = () => {
    if (!editingId || !form.name || !form.system_prompt) return;
    onUpdate(editingId, form);
    setEditingId(null);
    setForm({ name: '', system_prompt: '', icon: '🤖' });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Agents</h2>
        <button
          onClick={() => { setShowCreate(true); setEditingId(null); setForm({ name: '', system_prompt: '', icon: '🤖' }); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-accent-600 hover:bg-accent-700 rounded text-sm text-white"
        >
          <Plus size={14} /> New Agent
        </button>
      </div>

      {(showCreate || editingId) && (
        <div className="mb-6 p-4 bg-[#161b22] rounded-lg border border-gray-700/50">
          <div className="grid grid-cols-[auto_1fr] gap-3 mb-3">
            <input
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="w-12 bg-gray-900 border border-gray-700 rounded px-2 py-2 text-center text-lg"
              maxLength={4}
            />
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Agent name"
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500/50"
            />
          </div>
          <textarea
            value={form.system_prompt}
            onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
            placeholder="System prompt..."
            rows={4}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500/50 resize-none mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              className="flex items-center gap-1 px-3 py-1.5 bg-accent-600 hover:bg-accent-700 rounded text-sm text-white"
            >
              <Save size={14} /> {editingId ? 'Update' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setEditingId(null); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {agents.map((a) => (
          <div key={a.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 flex items-start justify-between group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">{a.icon}</span>
                <span className="font-medium text-white">{a.name}</span>
                {a.is_default ? <span className="text-xs bg-accent-600/30 text-accent-400 px-1.5 py-0.5 rounded">default</span> : null}
              </div>
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{a.system_prompt}</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              <button onClick={() => startEdit(a)} className="p-1 text-gray-400 hover:text-white">
                <Edit2 size={14} />
              </button>
              <button onClick={() => onDelete(a.id)} className="p-1 text-gray-400 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
