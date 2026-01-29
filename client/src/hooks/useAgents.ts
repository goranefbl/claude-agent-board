import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/http';
import type { Agent } from '../../../shared/types';

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setAgents(await api.get<Agent[]>('/agents'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (data: { name: string; system_prompt: string; icon?: string }) => {
    const a = await api.post<Agent>('/agents', data);
    setAgents((prev) => [...prev, a]);
    return a;
  };

  const update = async (id: string, data: Partial<Agent>) => {
    const a = await api.put<Agent>(`/agents/${id}`, data);
    setAgents((prev) => prev.map((x) => (x.id === id ? a : x)));
    return a;
  };

  const remove = async (id: string) => {
    await api.del(`/agents/${id}`);
    setAgents((prev) => prev.filter((a) => a.id !== id));
  };

  return { agents, loading, refresh, create, update, remove };
}
