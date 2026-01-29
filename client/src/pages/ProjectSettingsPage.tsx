import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import { api } from '../api/http';
import type { Project } from '../../../shared/types';

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gitPushDisabled, setGitPushDisabled] = useState(false);
  const [gitProtectedBranches, setGitProtectedBranches] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<Project>(`/projects/${id}`).then((p) => {
      setProject(p);
      setName(p.name);
      setDescription(p.description || '');
      setGitPushDisabled(!!p.git_push_disabled);
      setGitProtectedBranches(p.git_protected_branches || '');
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

          {/* Git settings */}
          {project.path && (
            <div className="mt-6 bg-[#161b22] rounded-lg border border-gray-700/50 p-6 space-y-4">
              <h2 className="text-sm font-medium text-gray-300 mb-3">Source Control</h2>

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
