import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Globe, FolderOpen, Loader, Sparkles } from 'lucide-react';
import { api } from '../../api/http';
import type { Skill, Project } from '../../../../shared/types';

interface CreateData {
  name: string;
  prompt: string;
  description?: string;
  scope?: string;
  project_ids?: string[];
  icon?: string;
}

interface Props {
  skills: Skill[];
  onCreate: (data: CreateData) => void;
  onUpdate: (id: string, data: Partial<Skill> & { project_ids?: string[] }) => void;
  onDelete: (id: string) => void;
}

const GENERAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

export default function SkillManager({ skills, onCreate, onUpdate, onDelete }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generateInput, setGenerateInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [form, setForm] = useState({ name: '', description: '', prompt: '', scope: 'global', icon: '', projectIds: [] as string[] });
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    api.get<Project[]>('/projects').then(setProjects).catch(() => {});
  }, []);

  const realProjects = projects.filter(p => p.id !== GENERAL_PROJECT_ID);

  const handleGenerate = async () => {
    if (!generateInput.trim()) return;
    setGenerating(true);
    setGenerateError('');
    try {
      const result = await api.post<{ name: string; description: string; prompt: string; icon: string }>('/skills/generate', { input: generateInput });
      setForm({
        name: result.name,
        description: result.description,
        prompt: result.prompt,
        scope: 'global',
        icon: result.icon || '',
        projectIds: [],
      });
      setGenerateInput('');
    } catch (err: any) {
      setGenerateError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = () => {
    if (!form.name || !form.prompt) return;
    onCreate({
      name: form.name,
      prompt: form.prompt,
      description: form.description,
      scope: form.scope,
      project_ids: form.scope === 'project' ? form.projectIds : undefined,
      icon: form.icon,
    });
    setForm({ name: '', description: '', prompt: '', scope: 'global', icon: '', projectIds: [] });
    setShowCreate(false);
  };

  const startEdit = (s: Skill) => {
    setEditingId(s.id);
    setShowCreate(false);
    setForm({
      name: s.name,
      description: s.description,
      prompt: s.prompt,
      scope: s.scope,
      icon: s.icon,
      projectIds: s.project_ids || [],
    });
  };

  const handleUpdate = () => {
    if (!editingId || !form.name || !form.prompt) return;
    onUpdate(editingId, {
      name: form.name,
      description: form.description,
      prompt: form.prompt,
      scope: form.scope as any,
      project_ids: form.scope === 'project' ? form.projectIds : [],
      icon: form.icon,
    });
    setEditingId(null);
    setForm({ name: '', description: '', prompt: '', scope: 'global', icon: '', projectIds: [] });
  };

  const toggleProjectId = (ids: string[], id: string): string[] =>
    ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || id.slice(0, 8);

  const renderProjectPicker = (selectedIds: string[], onChange: (ids: string[]) => void) => (
    <div className="mt-2">
      <label className="block text-xs text-gray-500 mb-1.5">Assign to projects</label>
      <div className="flex flex-wrap gap-1.5">
        {realProjects.map(p => {
          const selected = selectedIds.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(toggleProjectId(selectedIds, p.id))}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selected
                  ? 'bg-accent-600/30 text-accent-300 border border-accent-500/50'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>
      {realProjects.length === 0 && (
        <p className="text-xs text-gray-600 mt-1">No projects available</p>
      )}
    </div>
  );

  const globalSkills = skills.filter(s => s.scope === 'global');
  const projectSkills = skills.filter(s => s.scope === 'project');

  const renderSkillCard = (s: Skill) => (
    <div key={s.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 flex items-start justify-between group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
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
        {s.project_ids && s.project_ids.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {s.project_ids.map(pid => (
              <span key={pid} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                {projectName(pid)}
              </span>
            ))}
          </div>
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

  const closeForm = () => {
    setShowCreate(false);
    setEditingId(null);
    setGenerateInput('');
    setGenerateError('');
    setForm({ name: '', description: '', prompt: '', scope: 'global', icon: '', projectIds: [] });
  };

  const isFormFilled = !!form.name;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Skills</h2>
        <button
          onClick={() => { setShowCreate(true); setEditingId(null); setForm({ name: '', description: '', prompt: '', scope: 'global', icon: '', projectIds: [] }); setGenerateInput(''); setGenerateError(''); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-accent-600 hover:bg-accent-700 rounded text-sm text-white"
        >
          <Plus size={14} /> New Skill
        </button>
      </div>

      {/* New Skill / Edit form */}
      {(showCreate || editingId) && (
        <div className="mb-6 p-4 bg-[#161b22] rounded-lg border border-gray-700/50">
          {/* Generate step — only for new skills, before form is filled */}
          {showCreate && !isFormFilled && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">What should this skill do?</label>
              <p className="text-xs text-gray-500 mb-3">
                Describe the skill or paste a URL (skills.sh, GitHub SKILL.md, or any link). Claude will generate the skill for you.
              </p>
              <textarea
                value={generateInput}
                onChange={(e) => setGenerateInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !generating) { e.preventDefault(); handleGenerate(); } }}
                placeholder="e.g. Review PRs for security issues, or paste https://skills.sh/vercel-labs/agent-skills/web-design-guidelines"
                rows={3}
                disabled={generating}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500/50 resize-none disabled:opacity-50"
              />
              {generateError && <p className="text-xs text-red-400 mt-2">{generateError}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleGenerate}
                  disabled={generating || !generateInput.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 rounded text-sm text-white"
                >
                  {generating ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {generating ? 'Generating...' : 'Generate'}
                </button>
                <button onClick={closeForm} className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300">
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Detail form — shown for editing or after generation */}
          {(editingId || isFormFilled) && (
            <>
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
                rows={8}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500/50 resize-none mb-3"
              />
              <div className="mb-3">
                <select
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value })}
                  className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500/50"
                >
                  <option value="global">Global scope</option>
                  <option value="project">Project scope</option>
                </select>
                {form.scope === 'project' && renderProjectPicker(form.projectIds, (ids) => setForm({ ...form, projectIds: ids }))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={editingId ? handleUpdate : handleCreate}
                  className="flex items-center gap-1 px-3 py-1.5 bg-accent-600 hover:bg-accent-700 rounded text-sm text-white"
                >
                  <Save size={14} /> {editingId ? 'Update' : 'Create'}
                </button>
                <button onClick={closeForm} className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300">
                  <X size={14} /> Cancel
                </button>
              </div>
            </>
          )}
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

      {skills.length === 0 && !showCreate && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No skills yet</p>
          <p className="text-sm">Create a skill to teach your agents new capabilities</p>
        </div>
      )}
    </div>
  );
}
