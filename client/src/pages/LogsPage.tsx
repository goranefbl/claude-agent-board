import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../api/http';
import Sidebar from '../components/layout/Sidebar';

export default function LogsPage() {
  const [logs, setLogs] = useState('');
  const [logType, setLogType] = useState<'out' | 'error'>('out');
  const [lines, setLines] = useState(100);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const containerRef = useRef<HTMLPreElement>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ logs: string }>(`/logs?type=${logType}&lines=${lines}`);
      setLogs(data.logs);
      // Auto-scroll to bottom
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      }, 50);
    } catch (err: any) {
      setLogs(`Error fetching logs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [logType, lines]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, logType, lines]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1117]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800/50 bg-[#161b22]">
          <h2 className="text-lg font-bold text-white mr-4">Logs</h2>
          <div className="flex gap-1 bg-gray-800 rounded p-0.5">
            <button
              onClick={() => setLogType('out')}
              className={`px-3 py-1 text-xs rounded transition-colors ${logType === 'out' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              stdout
            </button>
            <button
              onClick={() => setLogType('error')}
              className={`px-3 py-1 text-xs rounded transition-colors ${logType === 'error' ? 'bg-red-900/50 text-red-400' : 'text-gray-400 hover:text-white'}`}
            >
              stderr
            </button>
          </div>
          <select
            value={lines}
            onChange={(e) => setLines(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
          >
            <option value={50}>50 lines</option>
            <option value={100}>100 lines</option>
            <option value={300}>300 lines</option>
            <option value={500}>500 lines</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 text-amber-500"
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Log content */}
        <pre
          ref={containerRef}
          className="flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed text-gray-300 bg-[#0d1117]"
        >
          {logs || (loading ? 'Loading...' : 'No logs available.')}
        </pre>
      </div>
    </div>
  );
}
