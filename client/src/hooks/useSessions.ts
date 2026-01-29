import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/http';
import type { Session } from '../../../shared/types';

export function useSessions(projectId: string | null) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [prevProjectId, setPrevProjectId] = useState(projectId);

  // Synchronous reset when projectId changes (runs during render, before effects)
  if (projectId !== prevProjectId) {
    setPrevProjectId(projectId);
    setSessions([]);
    setLoading(true);
  }

  const refresh = useCallback(async () => {
    if (!projectId) { setSessions([]); setLoading(false); return; }
    setLoading(true);
    try {
      setSessions(await api.get<Session[]>(`/sessions?project_id=${projectId}`));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (agentId: string, title?: string) => {
    if (!projectId) return;
    const s = await api.post<Session>('/sessions', { project_id: projectId, agent_id: agentId, title });
    setSessions((prev) => [s, ...prev]);
    return s;
  };

  const update = async (id: string, data: Partial<Pick<Session, 'title' | 'agent_id'>>) => {
    const s = await api.put<Session>(`/sessions/${id}`, data);
    setSessions((prev) => prev.map((x) => (x.id === id ? s : x)));
    return s;
  };

  const remove = async (id: string) => {
    await api.del(`/sessions/${id}`);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return { sessions, loading, refresh, create, update, remove };
}
