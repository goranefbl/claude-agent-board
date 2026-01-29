import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Download, Globe, FolderOpen } from 'lucide-react';
import type { Skill } from '../../../../shared/types';

interface CreateData {
  name: string;
  prompt: string;
  description?: string;
  scope?: string;
  project_id?: string;
  icon?: string;
  globs?: string[];
}

interface ImportData {
  url: string;
  scope?: string;
  project_id?: string;
}

interface Props {
  skills: Skill[];
  onCreate: (data: CreateData) => void;
  onUpdate: (id: string, data: Partial<Skill>) => void;
  onDelete: (id: string) => void;
  onImport: (data: ImportData) => Promise<Skill>;
}

export default function SkillManager({ skills, onCreate, onUpdate, onDelete, onImport }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [importScope, setImportScope] = useState('global');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [form, setForm] = useState({ name: '', description: '', prompt: '', scope: 'global', icon: '⚡' });

  const handleCreate = () => {
    if (!form.name || !form.prompt) return;
    onCreate({ name: form.name, prompt: form.prompt, description: form.description, scope: form.scope, icon: form.icon });
    setForm({ name: '', description: '', prompt: '', scope: 'global', icon: '⚡' });
    setShowCreate(false);
  };

  const startEdit = (s: Skill) => {
    setEditingId(s.id);
    setForm({ name: s.name, description: s.description, prompt: s.prompt, scope: s.scope, icon: s.icon });
  };

  const handleUpdate = () => {
    if (!editingId || !form.name || !form.prompt) return;
    onUpdate(editingId, { name: form.name, description: form.description, prompt: form.prompt, scope: form.scope as any, icon: form.icon });
    setEditingId(null);
    setForm({ name: '', description: '', prompt: '', scope: 'global', icon: '⚡' });
  };

  const handleImport = async () => {
    if (!importUrl) return;
    setImporting(true);
    setImportError('');
    try {
      await onImport({ url: importUrl, scope: importScope });
      setImportUrl('');
      setShowImport(false);
    } catch (err: any) {
      setImportError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const globalSkills = skills.filter(s => s.scope === 'global');
  const projectSkills = skills.filter(s => s.scope === 'project');

  const renderSkillCard = (s: Skill) => (
    <div key={s.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 flex items-start justify-between group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">{s.icon}</span>
          <span className="font-medium text-white">{s.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            s.scope === 'global' ? 'bg-accent-600/30 text-accent-400' : 'bg-purple-600/30 text-purple-400'
          }`}>
            {s.scope}
          </span>
          {s.source_url && (
            <span className="text-xs bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">imported</span>
          )}
        </div>
        {s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{s.prompt}</p>
        {s.globs && (
          <p className="text-xs text-gray-600 mt-1">Globs: {s.globs}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
        <button onClick={() => startEdit(s)} className="p-1 text-gray-400 hover:text-white">
          <Edit2 size={14} />
        </button>
        <button onClick={() => onDelete(s.id)} className="p-1 text-gray-400 hover:text-red-400">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Skills</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowImport(true); setShowCreate(false); setEditingId(null); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300"
          >
            <Download size={14} /> Import
          </button>
          <button
            onClick={() => { setShowCreate(true); setShowImport(false); setEditingId(null); setForm({ name: '', description: '', prompt: '', scope: 'global', icon: '⚡' }); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-accent-600 hover:bg-accent-700 rounded text-sm text-white"
          >
            <Plus size={14} /> New Skill
          </button>
        </div>
      </div>

      {/* Import form */}
      {showImport && (
        <div className="mb-6 p-4 bg-[#161b22] rounded-lg border border-gray-700/50">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Download size={16} /> Import Skill
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Import from a skills.sh URL (e.g. skills.sh/owner/repo/skill-name) or a direct SKILL.md URL.
          </p>
          <input
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://skills.sh/vercel-labs/agent-skills/web-design-guidelines"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500/50 mb-3"
          />
          <select
            value={importScope}
            onChange={(e) => setImportScope(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500/50 mb-3"
          >
            <option value="global">Global scope</option>
            <option value="project">Project scope</option>
          </select>
          {importError && <p className="text-xs text-red-400 mb-3">{importError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={importing || !importUrl}
              className="flex items-center gap-1 px-3 py-1.5 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 rounded text-sm text-white"
            >
              <Download size={14} /> {importing ? 'Importing...' : 'Import'}
            </button>
            <button
              onClick={() => { setShowImport(false); setImportError(''); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit form */}
      {(showCreate || editingId) && (
        <div className="mb-6 p-4 bg-[#161b22] rounded-lg border border-gray-700/50">
          <div className="flex gap-3 mb-3">
            <input
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="⚡"
              className="w-16 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-accent-500/50"
            />
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Skill name"
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500/50"
            />
          </div>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500/50 mb-3"
          />
          <textarea
            value={form.prompt}
            onChange={(e) => setForm({ ...form, prompt: e.target.value })}
            placeholder="Skill prompt — what should the agent know/do when this skill is active?"
            rows={6}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500/50 resize-none mb-3"
          />
          <div className="flex items-center gap-4 mb-3">
            <select
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500/50"
            >
              <option value="global">Global scope</option>
              <option value="project">Project scope</option>
            </select>
          </div>
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

      {/* Global Skills */}
      {globalSkills.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <Globe size={14} /> Global Skills
          </h3>
          <div className="space-y-3">
            {globalSkills.map(renderSkillCard)}
          </div>
        </div>
      )}

      {/* Project Skills */}
      {projectSkills.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <FolderOpen size={14} /> Project Skills
          </h3>
          <div className="space-y-3">
            {projectSkills.map(renderSkillCard)}
          </div>
        </div>
      )}

      {skills.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No skills yet</p>
          <p className="text-sm">Create a skill or import one from skills.sh</p>
        </div>
      )}
    </div>
  );
}
