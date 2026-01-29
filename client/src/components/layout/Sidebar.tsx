import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  MessageCircle, FolderPlus, MessageSquarePlus, Trash2,
  Zap, Bot, Plug, Settings, ScrollText, LogOut, User, LayoutGrid, Settings2
} from 'lucide-react';
import { AuthContext } from '../../App';
import { api } from '../../api/http';
import type { Project, Session } from '../../../../shared/types';

interface Props {
  projects?: Project[];
  sessions?: Session[];
  selectedProjectId?: string | null;
  selectedSessionId?: string | null;
  onSelectProject?: (id: string) => void;
  onSelectSession?: (id: string) => void;
  onCreateProject?: (name: string) => void;
  onCreateSession?: () => void;
  onDeleteProject?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
}

function SectionHeader({ label, onAction, actionIcon }: { label: string; onAction?: () => void; actionIcon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-2">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">{label}</span>
      {onAction && (
        <button onClick={onAction} className="text-gray-600 hover:text-gray-400 transition-colors">
          {actionIcon}
        </button>
      )}
    </div>
  );
}

function NavItem({ to, icon, label, active }: { to: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors relative ${
        active
          ? 'bg-gray-800/80 text-white'
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
      }`}
    >
      {active && <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-accent-500" />}
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar({
  projects: externalProjects, sessions = [], selectedProjectId, selectedSessionId,
  onSelectProject, onSelectSession, onCreateProject, onCreateSession,
  onDeleteProject, onDeleteSession,
}: Props) {
  const [newProjectName, setNewProjectName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [internalProjects, setInternalProjects] = useState<Project[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { username, logout } = useContext(AuthContext);

  // Fetch projects internally when not provided by parent
  const isManaged = !!onCreateProject;
  useEffect(() => {
    if (isManaged) return; // parent manages projects
    api.get<Project[]>('/projects').then(setInternalProjects).catch(() => {});
  }, [isManaged]);

  const projects = externalProjects || internalProjects;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    if (onCreateProject) {
      onCreateProject(newProjectName.trim());
    } else {
      // Create project and navigate to chat
      api.post<Project>('/projects', { name: newProjectName.trim() }).then((p) => {
        setInternalProjects((prev) => [p, ...prev]);
        navigate(`/chat?project=${p.id}`);
      });
    }
    setNewProjectName('');
    setShowForm(false);
  };

  const handleDeleteProject = (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? All sessions and messages in this project will be permanently lost.`)) return;
    if (onDeleteProject) {
      onDeleteProject(id);
    } else {
      api.del(`/projects/${id}`).then(() => {
        setInternalProjects((prev) => prev.filter((p) => p.id !== id));
      });
    }
  };

  const handleProjectClick = (id: string) => {
    if (onSelectProject) {
      onSelectProject(id);
    } else {
      // Navigate to chat with this project
      navigate(`/chat?project=${id}`);
    }
  };

  const onChatPage = location.pathname === '/chat' || location.pathname === '/';
  // "Chat" nav is only active when on /chat without a project selected
  const isChatActive = onChatPage && !selectedProjectId;

  return (
    <aside className="w-64 bg-[#0d1117] border-r border-gray-800/50 flex flex-col h-full select-none">
      <div className="px-4 py-4 border-b border-gray-800/50">
        <Link to="/chat" className="flex items-center gap-2">
          <span className="text-base font-bold text-white tracking-tight">WPGensHQ</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* CHAT section */}
        <SectionHeader label="Chat" />
        <NavItem to="/chat" icon={<MessageCircle size={16} />} label="Chat" active={isChatActive} />
        <NavItem to="/board" icon={<LayoutGrid size={16} />} label="Mission Control" active={location.pathname === '/board'} />

        {/* PROJECTS section — always shown */}
        <SectionHeader
          label="Projects"
          onAction={() => setShowForm(!showForm)}
          actionIcon={<FolderPlus size={14} />}
        />

        {showForm && (
          <form onSubmit={handleSubmit} className="px-4 pb-2">
            <input
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              className="w-full px-2.5 py-1.5 text-sm bg-gray-800/60 border border-gray-700/50 rounded text-white placeholder-gray-500 focus:outline-none focus:border-accent-500/50"
            />
          </form>
        )}

        {projects.map((p) => (
          <div key={p.id}>
            <div
              onClick={() => handleProjectClick(p.id)}
              className={`flex items-center justify-between px-4 py-2 cursor-pointer text-sm group relative transition-colors ${
                selectedProjectId === p.id
                  ? 'bg-gray-800/60 text-white'
                  : 'text-gray-400 hover:bg-gray-800/30 hover:text-gray-200'
              }`}
            >
              {selectedProjectId === p.id && (
                <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-accent-500" />
              )}
              <span className="truncate pl-1">{p.name}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/projects/${p.id}`);
                  }}
                  className="text-gray-600 hover:text-gray-300 transition-colors"
                  title="Project settings"
                >
                  <Settings2 size={13} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProject(p.id, p.name);
                  }}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Sessions under selected project */}
            {isManaged && selectedProjectId === p.id && (
              <div className="ml-5 border-l border-gray-800/60">
                <button
                  onClick={onCreateSession}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-accent-400 w-full transition-colors"
                >
                  <MessageSquarePlus size={12} /> New Session
                </button>
                {sessions.filter(s => s.project_id === p.id).map((s) => (
                  <div
                    key={s.id}
                    onClick={() => onSelectSession?.(s.id)}
                    className={`flex items-center justify-between px-3 py-1.5 cursor-pointer text-xs group transition-colors ${
                      selectedSessionId === s.id ? 'text-accent-400' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <span className="truncate">{s.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteSession?.(s.id); }}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-opacity"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {projects.length === 0 && (
          <div className="px-4 py-2 text-xs text-gray-600">No projects yet</div>
        )}

        {/* AGENT section */}
        <SectionHeader label="Agent" />
        <NavItem to="/skills" icon={<Zap size={16} />} label="Skills" active={location.pathname === '/skills'} />
        <NavItem to="/agents" icon={<Bot size={16} />} label="Agents" active={location.pathname === '/agents'} />
        <NavItem to="/mcps" icon={<Plug size={16} />} label="MCPs" active={location.pathname === '/mcps'} />

        {/* SETTINGS section */}
        <SectionHeader label="Settings" />
        <NavItem to="/settings" icon={<Settings size={16} />} label="Config" active={location.pathname === '/settings'} />
        <NavItem to="/logs" icon={<ScrollText size={16} />} label="Logs" active={location.pathname === '/logs'} />
      </div>

      {/* User / Logout */}
      <div className="border-t border-gray-800/50 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
              <User size={14} className="text-gray-400" />
            </div>
            <span className="text-sm text-gray-300 truncate">{username || 'User'}</span>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
