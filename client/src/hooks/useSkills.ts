import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/http';
import type { Skill } from '../../../shared/types';

interface SessionSkill extends Skill {
  enabled: number;
}

interface CreateSkillData {
  name: string;
  prompt: string;
  description?: string;
  scope?: string;
  project_id?: string;
  icon?: string;
  globs?: string[];
}

interface ImportSkillData {
  url: string;
  scope?: string;
  project_id?: string;
}

export function useSkills(projectId?: string | null) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = projectId ? `?project_id=${projectId}` : '';
      setSkills(await api.get<Skill[]>(`/skills${params}`));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (data: CreateSkillData) => {
    const s = await api.post<Skill>('/skills', data);
    setSkills((prev) => [...prev, s]);
    return s;
  };

  const importSkill = async (data: ImportSkillData) => {
    const s = await api.post<Skill>('/skills/import', data);
    setSkills((prev) => [...prev, s]);
    return s;
  };

  const update = async (id: string, data: Partial<Skill>) => {
    const s = await api.put<Skill>(`/skills/${id}`, data);
    setSkills((prev) => prev.map((x) => (x.id === id ? s : x)));
    return s;
  };

  const remove = async (id: string) => {
    await api.del(`/skills/${id}`);
    setSkills((prev) => prev.filter((s) => s.id !== id));
  };

  return { skills, loading, refresh, create, importSkill, update, remove };
}

export function useSessionSkills(sessionId: string | null, projectId?: string | null) {
  const [skills, setSkills] = useState<SessionSkill[]>([]);

  const refresh = useCallback(async () => {
    if (!sessionId) { setSkills([]); return; }
    const params = projectId ? `?project_id=${projectId}` : '';
    setSkills(await api.get<SessionSkill[]>(`/skills/session/${sessionId}${params}`));
  }, [sessionId, projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (skillId: string, enabled: boolean) => {
    if (!sessionId) return;
    await api.put(`/skills/session/${sessionId}/${skillId}`, { enabled });
    setSkills((prev) => prev.map((s) => (s.id === skillId ? { ...s, enabled: enabled ? 1 : 0 } : s)));
  };

  return { skills, refresh, toggle };
}
