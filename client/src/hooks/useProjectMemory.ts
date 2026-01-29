import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/http';

interface ProjectMemoryData {
  summary: string;
}

export function useProjectMemory(projectId: string | null) {
  const [memory, setMemory] = useState<ProjectMemoryData | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) { setMemory(null); return; }
    try {
      setMemory(await api.get<ProjectMemoryData>(`/memory/project/${projectId}`));
    } catch {
      setMemory(null);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const update = async (summary: string) => {
    if (!projectId) return;
    const updated = await api.put<ProjectMemoryData>(`/memory/project/${projectId}`, { summary });
    setMemory(updated);
  };

  return { memory, refresh, update };
}
