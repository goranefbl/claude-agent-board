import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Globe, FolderOpen } from 'lucide-react';
import { api } from '../../api/http';
import type { Api, Project } from '../../../../shared/types';

interface CreateData {
  name: string;
  base_url: string;
  description?: string;
  auth_type?: string;
  auth_config?: string;
  spec?: string;
  scope?: string;
  project_ids?: string[];
  icon?: string;
}

interface Props {
  apis: Api[];
  onCreate: (data: CreateData) => void;
  onUpdate: (id: string, data: Partial<Api> & { project_ids?: string[] }) => void;
  onDelete: (id: string) => void;
}

const AUTH_TYPES = [
  { value: 'none', label: 'No auth' },
  { value: 'bearer', label: 'Bearer token' },
  { value: 'header', label: 'Custom header' },
  { value: 'query', label: 'Query param' },
  { value: 'basic', label: 'Basic auth' },
];

const GENERAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

interface FormState {
  name: string;
  description: string;
  base_url: string;
  auth_type: string;
  auth_config: Record<string, string>;
  spec: string;
  scope: string;
  icon: string;
  projectIds: string[];
}

const emptyForm: FormState = {
  name: '', description: '', base_url: '', auth_type: 'none',
  auth_config: {}, spec: '', scope: 'global', icon: '', projectIds: [],
};

export default function ApiManager({ apis, onCreate, onUpdate, onDelete }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    api.get<Project[]>('/projects').then(setProjects).catch(() => {});
  }, []);

  const realProjects = projects.filter(p => p.id !== GENERAL_PROJECT_ID);

  const parseAuthConfig = (json: string): Record<string, string> => {
    try { return JSON.parse(json || '{}'); } catch { return {}; }
  };

  const handleCreate = () => {
    if (!form.name || !form.base_url) return;
    onCreate({
      name: form.name,
      base_url: form.base_url,
      description: form.description,
      auth_type: form.auth_type,
      auth_config: JSON.stringify(form.auth_config),
      spec: form.spec,
      scope: form.scope,
      project_ids: form.scope === 'project' ? form.projectIds : undefined,
      icon: form.icon,
    });
    setForm({ ...emptyForm });
    setShowCreate(false);
  };

  const startEdit = (a: Api) => {
    setEditingId(a.id);
    setShowCreate(false);
    setForm({
      name: a.name,
      description: a.description,
      base_url: a.base_url,
      auth_type: a.auth_type,
      auth_config: parseAuthConfig(a.auth_config),
      spec: a.spec,
      scope: a.scope,
      icon: a.icon,
      projectIds: a.project_ids || [],
    });
  };

  const handleUpdate = () => {
    if (!editingId || !form.name || !form.base_url) return;
    onUpdate(editingId, {
      name: form.name,
      description: form.description,
      base_url: form.base_url,
      auth_type: form.auth_type as any,
      auth_config: JSON.stringify(form.auth_config),
      spec: form.spec,
      scope: form.scope as any,
      project_ids: form.scope === 'project' ? form.projectIds : [],
      icon: form.icon,
    });
    setEditingId(null);
    setForm({ ...emptyForm });
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

  const renderAuthFields = () => {
    const cfg = form.auth_config;
    const set = (key: string, val: string) => setForm({ ...form, auth_config: { ...cfg, [key]: val } });
    const inputCls = "w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500/50";

    switch (form.auth_type) {
      case 'bearer':
        return (
          <input value={cfg.token || ''} onChange={e => set('token', e.target.value)}
            placeholder="Bearer token" className={inputCls} />
        );
      case 'header':
        return (
          <div className="flex gap-2">
            <input value={cfg.header_name || ''} onChange={e => set('header_name', e.target.value)}
              placeholder="Header name" className={inputCls} />
            <input value={cfg.header_value || ''} onChange={e => set('header_value', e.target.value)}
              placeholder="Header value" className={inputCls} />
          </div>
        );
      case 'query':
        return (
          <div className="flex gap-2">
            <input value={cfg.param_name || ''} onChange={e => set('param_name', e.target.value)}
              placeholder="Param name" className={inputCls} />
            <input value={cfg.param_value || ''} onChange={e => set('param_value', e.target.value)}
              placeholder="Param value" className={inputCls} />
          </div>
        );
      case 'basic':
        return (
          <div className="flex gap-2">
            <input value={cfg.username || ''} onChange={e => set('username', e.target.value)}
              placeholder="Username" className={inputCls} />
            <input value={cfg.password || ''} onChange={e => set('password', e.target.value)}
              placeholder="Password" type="password" className={inputCls} />
          </div>
        );
      default:
        return null;
    }
  };

  const closeForm = () => {
    setShowCreate(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const globalApis = apis.filter(a => a.scope === 'global');
  const projectApis = apis.filter(a => a.scope === 'project');

  const authLabel = (type: string) => AUTH_TYPES.find(t => t.value === type)?.label || type;

  const renderApiCard = (a: Api) => (
    <div key={a.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 flex items-start justify-between group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg">{a.icon}</span>
          <span className="font-medium text-white">{a.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            a.scope === 'global' ? 'bg-accent-600/30 text-accent-400' : 'bg-purple-600/30 text-purple-400'
          }`}>
            {a.scope}
          </span>
          {a.auth_type !== 'none' && (
            <span className="text-xs bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">
              {authLabel(a.auth_type)}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{a.base_url}</p>
        {a.description && <p className="text-xs text-gray-400 mt-1">{a.description}</p>}
        {a.project_ids && a.project_ids.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {a.project_ids.map(pid => (
              <span key={pid} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                {projectName(pid)}
              </span>
            ))}
          </div>
        )}
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
  );

  const inputCls = "w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500/50";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">APIs</h2>
        <button
          onClick={() => { setShowCreate(true); setEditingId(null); setForm({ ...emptyForm }); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-accent-600 hover:bg-accent-700 rounded text-sm text-white"
        >
          <Plus size={14} /> New API
        </button>
      </div>

      {(showCreate || editingId) && (
        <div className="mb-6 p-4 bg-[#161b22] rounded-lg border border-gray-700/50">
          <div className="flex gap-3 mb-3">
            <input
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="🔌"
              className="w-16 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-accent-500/50"
            />
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="API name"
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500/50"
            />
          </div>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description"
            className={`${inputCls} mb-3`}
          />
          <input
            value={form.base_url}
            onChange={(e) => setForm({ ...form, base_url: e.target.value })}
            placeholder="Base URL (e.g. https://api.example.com/v1)"
            className={`${inputCls} mb-3`}
          />
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1.5">Authentication</label>
            <select
              value={form.auth_type}
              onChange={(e) => setForm({ ...form, auth_type: e.target.value, auth_config: {} })}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500/50 mb-2"
            >
              {AUTH_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {renderAuthFields()}
          </div>
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1.5">
              API spec / docs
            </label>
            <textarea
              value={form.spec}
              onChange={(e) => setForm({ ...form, spec: e.target.value })}
              placeholder="Paste OpenAPI spec, endpoint docs, or describe available endpoints"
              rows={10}
              className={`${inputCls} resize-none`}
            />
          </div>
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
        </div>
      )}

      {globalApis.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <Globe size={14} /> Global APIs
          </h3>
          <div className="space-y-3">
            {globalApis.map(renderApiCard)}
          </div>
        </div>
      )}

      {projectApis.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <FolderOpen size={14} /> Project APIs
          </h3>
          <div className="space-y-3">
            {projectApis.map(renderApiCard)}
          </div>
        </div>
      )}

      {apis.length === 0 && !showCreate && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No APIs yet</p>
          <p className="text-sm">Register an external API to make it available to your agents</p>
        </div>
      )}
    </div>
  );
}
