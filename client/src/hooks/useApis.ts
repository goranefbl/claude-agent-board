import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/http';
import type { Api } from '../../../shared/types';

interface SessionApi extends Api {
  enabled: number;
}

interface CreateApiData {
  name: string;
  base_url: string;
  description?: string;
  auth_type?: string;
  auth_config?: string;
  spec?: string;
  scope?: string;
  project_ids?: string[];
  icon?: string;
}

export function useApis(projectId?: string | null) {
  const [apis, setApis] = useState<Api[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = projectId ? `?project_id=${projectId}` : '';
      setApis(await api.get<Api[]>(`/apis${params}`));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (data: CreateApiData) => {
    const a = await api.post<Api>('/apis', data);
    setApis((prev) => [...prev, a]);
    return a;
  };

  const update = async (id: string, data: Partial<Api> & { project_ids?: string[] }) => {
    const a = await api.put<Api>(`/apis/${id}`, data);
    setApis((prev) => prev.map((x) => (x.id === id ? a : x)));
    return a;
  };

  const remove = async (id: string) => {
    await api.del(`/apis/${id}`);
    setApis((prev) => prev.filter((a) => a.id !== id));
  };

  return { apis, loading, refresh, create, update, remove };
}

export function useSessionApis(sessionId: string | null, projectId?: string | null) {
  const [apis, setApis] = useState<SessionApi[]>([]);

  const refresh = useCallback(async () => {
    if (!sessionId) { setApis([]); return; }
    const params = projectId ? `?project_id=${projectId}` : '';
    setApis(await api.get<SessionApi[]>(`/apis/session/${sessionId}${params}`));
  }, [sessionId, projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (apiId: string, enabled: boolean) => {
    if (!sessionId) return;
    await api.put(`/apis/session/${sessionId}/${apiId}`, { enabled });
    setApis((prev) => prev.map((a) => (a.id === apiId ? { ...a, enabled: enabled ? 1 : 0 } : a)));
  };

  return { apis, refresh, toggle };
}
