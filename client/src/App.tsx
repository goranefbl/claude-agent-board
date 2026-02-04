import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { MobileSidebarProvider } from './components/layout/MobileSidebar';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import AgentsPage from './pages/AgentsPage';
import SkillsPage from './pages/SkillsPage';
import LogsPage from './pages/LogsPage';
import ConfigPage from './pages/ConfigPage';
import MissionControlPage from './pages/MissionControlPage';
import ProjectSettingsPage from './pages/ProjectSettingsPage';
import McpsPage from './pages/McpsPage';
import ApisPage from './pages/ApisPage';

export default function App() {
  const { authenticated, loading, login, logout, username, userId, email, role } = useAuth();
  useTheme();

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
    <AuthContext.Provider value={{ username, userId, email, role, logout }}>
      <MobileSidebarProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/login" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/board" element={<MissionControlPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/mcps" element={<McpsPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/apis" element={<ApisPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/projects/:id" element={<ProjectSettingsPage />} />
          <Route path="/settings" element={<ConfigPage />} />
        </Routes>
      </MobileSidebarProvider>
    </AuthContext.Provider>
  );
}

// Auth context for sidebar user/logout
interface AuthContextType {
  username: string | null;
  userId: string | null;
  email: string | null;
  role: 'admin' | 'user' | null;
  logout: () => void;
}

export const AuthContext = React.createContext<AuthContextType>({
  username: null,
  userId: null,
  email: null,
  role: null,
  logout: () => {},
});
