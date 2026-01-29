import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import { api } from '../api/http';
import { useProjectMemory } from '../hooks/useProjectMemory';
import type { Project } from '../../../shared/types';

const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
];

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gitOriginUrl, setGitOriginUrl] = useState('');
  const [gitPushDisabled, setGitPushDisabled] = useState(false);
  const [gitProtectedBranches, setGitProtectedBranches] = useState('');
  const [color, setColor] = useState('');
  const [autoSummarize, setAutoSummarize] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { memory: projectMemory, update: updateProjectMemory } = useProjectMemory(id || null);
  const [memSummaryDraft, setMemSummaryDraft] = useState('');
  const [editingMemSummary, setEditingMemSummary] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<Project>(`/projects/${id}`).then((p) => {
      setProject(p);
      setName(p.name);
      setDescription(p.description || '');
      setGitOriginUrl(p.git_origin_url || '');
      setGitPushDisabled(!!p.git_push_disabled);
      setGitProtectedBranches(p.git_protected_branches || '');
      setColor(p.color || '');
      setAutoSummarize(p.auto_summarize !== 0);
    }).catch(() => navigate('/chat'));
  }, [id, navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api.put<Project>(`/projects/${id}`, {
        name,
        description,
        color,
        auto_summarize: autoSummarize ? 1 : 0,
        git_origin_url: gitOriginUrl,
        git_push_disabled: gitPushDisabled ? 1 : 0,
        git_protected_branches: gitProtectedBranches,
      });
      setProject(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !project) return;
    if (!window.confirm(`Delete "${project.name}"? All sessions and messages will be permanently lost.`)) return;
    await api.del(`/projects/${id}`);
    navigate('/chat');
  };

  if (!project) {
    return (
      <div className="flex h-screen overflow-hidden bg-[#0d1117]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500 text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1117]">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-10 px-6">
          <h1 className="text-xl font-bold text-white mb-6">Project Settings</h1>

          <form onSubmit={handleSave} className="bg-[#161b22] rounded-lg border border-gray-700/50 p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500/50 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Color</label>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setColor('')}
                  className={`w-7 h-7 rounded-full border-2 bg-gray-600 flex items-center justify-center transition-colors ${
                    color === '' ? 'border-white' : 'border-transparent hover:border-gray-500'
                  }`}
                  title="None"
                >
                  {color === '' && <Check size={14} className="text-white" />}
                </button>
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                      color === c ? 'border-white' : 'border-transparent hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {color === c && <Check size={14} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSummarize}
                onChange={(e) => setAutoSummarize(e.target.checked)}
                className="rounded border-gray-600 bg-gray-900 text-accent-500 focus:ring-accent-500/50"
              />
              <span className="text-sm text-gray-300">Auto-summarize sessions</span>
            </label>

            {project.path && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Path</label>
                <div className="text-sm text-gray-400 bg-gray-900/50 border border-gray-800 rounded px-3 py-2 font-mono">
                  {project.path}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-4 py-2 rounded transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              {saved && <span className="text-sm text-green-400">Saved</span>}
            </div>
          </form>

          {/* Info section */}
          <div className="mt-6 bg-[#161b22] rounded-lg border border-gray-700/50 p-6 space-y-3">
            <h2 className="text-sm font-medium text-gray-300 mb-3">Info</h2>
            <div className="text-xs text-gray-500 space-y-1">
              <div>ID: <span className="text-gray-400 font-mono">{project.id}</span></div>
              <div>Created: <span className="text-gray-400">{new Date(project.created_at).toLocaleString()}</span></div>
            </div>
          </div>

          {/* Project Memory */}
          {projectMemory && (
            <div className="mt-6 bg-[#161b22] rounded-lg border border-gray-700/50 p-6 space-y-4">
              <h2 className="text-sm font-medium text-gray-300 mb-3">Project Memory</h2>
              <p className="text-xs text-gray-500">Shared context visible to Claude across all sessions in this project.</p>

              <div>
                {editingMemSummary ? (
                  <div>
                    <textarea
                      value={memSummaryDraft}
                      onChange={(e) => setMemSummaryDraft(e.target.value)}
                      rows={4}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500/50 resize-none"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => { updateProjectMemory(memSummaryDraft); setEditingMemSummary(false); }}
                        className="bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-3 py-1.5 rounded transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMemSummary(false)}
                        className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium px-3 py-1.5 rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    onClick={() => { setMemSummaryDraft(projectMemory.summary); setEditingMemSummary(true); }}
                    className="text-sm text-gray-400 bg-gray-900/50 border border-gray-800 rounded px-3 py-2 cursor-pointer hover:text-gray-300 min-h-[2.5em] whitespace-pre-wrap"
                  >
                    {projectMemory.summary || 'Click to add project memory...'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Git settings */}
          {project.path && (
            <div className="mt-6 bg-[#161b22] rounded-lg border border-gray-700/50 p-6 space-y-4">
              <h2 className="text-sm font-medium text-gray-300 mb-3">Source Control</h2>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Origin URL</label>
                <input
                  type="text"
                  value={gitOriginUrl}
                  onChange={(e) => setGitOriginUrl(e.target.value)}
                  placeholder="https://github.com/user/repo.git"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500/50 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">Remote repository URL for this project</p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gitPushDisabled}
                  onChange={(e) => setGitPushDisabled(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-900 text-accent-500 focus:ring-accent-500/50"
                />
                <span className="text-sm text-gray-300">Disable push (pull-only mode)</span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Protected branches</label>
                <input
                  type="text"
                  value={gitProtectedBranches}
                  onChange={(e) => setGitProtectedBranches(e.target.value)}
                  placeholder="main, production"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500/50"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated list of branches where push is blocked</p>
              </div>
            </div>
          )}

          {/* Danger zone */}
          <div className="mt-6 bg-[#161b22] rounded-lg border border-gray-700/50 p-6">
            <h2 className="text-sm font-medium text-gray-300 mb-3">Danger Zone</h2>
            <button
              onClick={handleDelete}
              className="text-red-400 hover:text-red-500 text-sm transition-colors"
            >
              Delete project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
