import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/http';
import type { Project } from '../../../shared/types';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await api.get<Project[]>('/projects'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (name: string, description = '') => {
    const p = await api.post<Project>('/projects', { name, description });
    setProjects((prev) => [p, ...prev]);
    return p;
  };

  const remove = async (id: string) => {
    await api.del(`/projects/${id}`);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return { projects, loading, refresh, create, remove };
}
