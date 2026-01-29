import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/http';
import type { McpServer } from '../../../shared/types';

export function useMcps() {
  const [mcps, setMcps] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setMcps(await api.get<McpServer[]>('/mcps'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (data: { name: string; description?: string; command: string; args: string; env: string }) => {
    const m = await api.post<McpServer>('/mcps', data);
    setMcps((prev) => [...prev, m]);
    return m;
  };

  const update = async (id: string, data: Partial<McpServer>) => {
    const m = await api.put<McpServer>(`/mcps/${id}`, data);
    setMcps((prev) => prev.map((x) => (x.id === id ? m : x)));
    return m;
  };

  const remove = async (id: string) => {
    await api.del(`/mcps/${id}`);
    setMcps((prev) => prev.filter((m) => m.id !== id));
  };

  return { mcps, loading, refresh, create, update, remove };
}
