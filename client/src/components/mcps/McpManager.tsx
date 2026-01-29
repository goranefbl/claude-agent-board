import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Power, PowerOff } from 'lucide-react';
import type { McpServer } from '../../../../shared/types';

interface Props {
  mcps: McpServer[];
  onCreate: (data: { name: string; description: string; command: string; args: string; env: string }) => void;
  onUpdate: (id: string, data: Partial<McpServer>) => void;
  onDelete: (id: string) => void;
}

const emptyForm = { name: '', description: '', command: '', args: '', env: '' };

export default function McpManager({ mcps, onCreate, onUpdate, onDelete }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const handleCreate = () => {
    if (!form.name || !form.command) return;
    // Convert args from one-per-line to JSON array
    const argsArray = form.args.split('\n').map(a => a.trim()).filter(Boolean);
    // Convert env from key=value lines to JSON object
    const envObj: Record<string, string> = {};
    form.env.split('\n').filter(l => l.includes('=')).forEach(l => {
      const [k, ...v] = l.split('=');
      envObj[k.trim()] = v.join('=').trim();
    });
    onCreate({
      name: form.name,
      description: form.description,
      command: form.command,
      args: JSON.stringify(argsArray),
      env: JSON.stringify(envObj),
    });
    setForm(emptyForm);
    setShowCreate(false);
  };

  const startEdit = (m: McpServer) => {
    setEditingId(m.id);
    // Convert JSON array to one-per-line
    let argsText = '';
    try { argsText = (JSON.parse(m.args) as string[]).join('\n'); } catch { argsText = m.args; }
    // Convert JSON object to key=value lines
    let envText = '';
    try {
      const obj = JSON.parse(m.env) as Record<string, string>;
      envText = Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n');
    } catch { envText = m.env; }
    setForm({ name: m.name, description: m.description, command: m.command, args: argsText, env: envText });
  };

  const handleUpdate = () => {
    if (!editingId || !form.name || !form.command) return;
    const argsArray = form.args.split('\n').map(a => a.trim()).filter(Boolean);
    const envObj: Record<string, string> = {};
    form.env.split('\n').filter(l => l.includes('=')).forEach(l => {
      const [k, ...v] = l.split('=');
      envObj[k.trim()] = v.join('=').trim();
    });
    onUpdate(editingId, {
      name: form.name,
      description: form.description,
      command: form.command,
      args: JSON.stringify(argsArray),
      env: JSON.stringify(envObj),
    });
    setEditingId(null);
    setForm(emptyForm);
  };

  const toggleEnabled = (m: McpServer) => {
    onUpdate(m.id, { enabled: m.enabled ? 0 : 1 });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">MCP Servers</h2>
          <p className="text-xs text-gray-500 mt-1">Model Context Protocol servers provide tools to Claude agents</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditingId(null); setForm(emptyForm); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 rounded text-sm text-white"
        >
          <Plus size={14} /> Add MCP
        </button>
      </div>

      {(showCreate || editingId) && (
        <div className="mb-6 p-4 bg-[#161b22] rounded-lg border border-gray-700/50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My MCP Server"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Command</label>
              <input
                value={form.command}
                onChange={(e) => setForm({ ...form, command: e.target.value })}
                placeholder="npx"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this MCP server do?"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Arguments (one per line)</label>
            <textarea
              value={form.args}
              onChange={(e) => setForm({ ...form, args: e.target.value })}
              placeholder={"-y\nsome-mcp-package@latest\n--flag"}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Environment variables (KEY=value, one per line)</label>
            <textarea
              value={form.env}
              onChange={(e) => setForm({ ...form, env: e.target.value })}
              placeholder="API_KEY=abc123"
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none font-mono"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 rounded text-sm text-white"
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
        {mcps.map((m) => (
          <div key={m.id} className={`p-4 rounded-lg border flex items-start justify-between group ${
            m.enabled ? 'bg-gray-800/50 border-gray-700/50' : 'bg-gray-900/30 border-gray-800/30 opacity-60'
          }`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{m.name}</span>
                {m.is_default ? <span className="text-xs bg-amber-600/30 text-amber-400 px-1.5 py-0.5 rounded">default</span> : null}
                {!m.enabled && <span className="text-xs bg-gray-700/50 text-gray-500 px-1.5 py-0.5 rounded">disabled</span>}
              </div>
              {m.description && <p className="text-xs text-gray-400 mt-1">{m.description}</p>}
              <div className="text-xs text-gray-600 mt-1.5 font-mono">
                {m.command} {(() => { try { return (JSON.parse(m.args) as string[]).join(' '); } catch { return m.args; } })()}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              <button
                onClick={() => toggleEnabled(m)}
                className={`p-1 ${m.enabled ? 'text-green-400 hover:text-red-400' : 'text-gray-500 hover:text-green-400'}`}
                title={m.enabled ? 'Disable' : 'Enable'}
              >
                {m.enabled ? <Power size={14} /> : <PowerOff size={14} />}
              </button>
              <button onClick={() => startEdit(m)} className="p-1 text-gray-400 hover:text-white">
                <Edit2 size={14} />
              </button>
              {!m.is_default && (
                <button onClick={() => onDelete(m.id)} className="p-1 text-gray-400 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
