import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import AgentsPage from './pages/AgentsPage';
import SkillsPage from './pages/SkillsPage';
import LogsPage from './pages/LogsPage';
import ConfigPage from './pages/ConfigPage';
import MissionControlPage from './pages/MissionControlPage';
import ProjectSettingsPage from './pages/ProjectSettingsPage';

export default function App() {
  const { authenticated, loading, login, logout, username } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <AuthContext.Provider value={{ username, logout }}>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/login" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/board" element={<MissionControlPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/projects/:id" element={<ProjectSettingsPage />} />
        <Route path="/settings" element={<ConfigPage />} />
      </Routes>
    </AuthContext.Provider>
  );
}

// Auth context for sidebar user/logout
interface AuthContextType {
  username: string | null;
  logout: () => void;
}

export const AuthContext = React.createContext<AuthContextType>({
  username: null,
  logout: () => {},
});
