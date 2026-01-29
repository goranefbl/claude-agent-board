import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/http';

interface MemoryData {
  summary: string;
}

export function useMemory(sessionId: string | null) {
  const [memory, setMemory] = useState<MemoryData | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId) { setMemory(null); return; }
    try {
      setMemory(await api.get<MemoryData>(`/memory/${sessionId}`));
    } catch {
      setMemory(null);
    }
  }, [sessionId]);

  useEffect(() => { refresh(); }, [refresh]);

  const update = async (data: Partial<MemoryData>) => {
    if (!sessionId) return;
    const updated = await api.put<MemoryData>(`/memory/${sessionId}`, data);
    setMemory(updated);
  };

  return { memory, refresh, update };
}
