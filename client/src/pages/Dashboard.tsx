import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Bot, Settings } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-white text-center mb-2">Claude Chat</h1>
        <p className="text-gray-400 text-center mb-10">Local chat UI for Claude Code</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/chat"
            className="p-6 bg-gray-800/50 border border-gray-700/50 rounded-lg hover:bg-gray-800 hover:border-gray-600 transition-colors text-center"
          >
            <MessageSquare size={32} className="mx-auto mb-3 text-accent-400" />
            <h2 className="font-semibold text-white mb-1">Chat</h2>
            <p className="text-xs text-gray-400">Start or continue conversations</p>
          </Link>

          <Link
            to="/agents"
            className="p-6 bg-gray-800/50 border border-gray-700/50 rounded-lg hover:bg-gray-800 hover:border-gray-600 transition-colors text-center"
          >
            <Bot size={32} className="mx-auto mb-3 text-accent-300" />
            <h2 className="font-semibold text-white mb-1">Agents</h2>
            <p className="text-xs text-gray-400">Manage agent personas</p>
          </Link>

          <Link
            to="/skills"
            className="p-6 bg-gray-800/50 border border-gray-700/50 rounded-lg hover:bg-gray-800 hover:border-gray-600 transition-colors text-center"
          >
            <Settings size={32} className="mx-auto mb-3 text-accent-200" />
            <h2 className="font-semibold text-white mb-1">Skills</h2>
            <p className="text-xs text-gray-400">Manage prompt skills</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
