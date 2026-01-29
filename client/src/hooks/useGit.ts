import { useState, useCallback } from 'react';
import { api } from '../api/http';
import type { GitStatusResult, GitBranch, GitLogEntry, GitDiffResult } from '../../../shared/types';

export function useGit(projectId: string | null) {
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [log, setLog] = useState<GitLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [s, b, l] = await Promise.all([
        api.get<GitStatusResult>(`/git/status/${projectId}`),
        api.get<GitBranch[]>(`/git/branches/${projectId}`).catch(() => []),
        api.get<GitLogEntry[]>(`/git/log/${projectId}`).catch(() => []),
      ]);
      setStatus(s);
      setBranches(b);
      setLog(l);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const stage = useCallback(async (paths: string[]) => {
    if (!projectId) return;
    try {
      await api.post(`/git/stage/${projectId}`, { paths });
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }, [projectId, refresh]);

  const unstage = useCallback(async (paths: string[]) => {
    if (!projectId) return;
    try {
      await api.post(`/git/unstage/${projectId}`, { paths });
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }, [projectId, refresh]);

  const commit = useCallback(async (message: string) => {
    if (!projectId) return;
    try {
      await api.post(`/git/commit/${projectId}`, { message });
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }, [projectId, refresh]);

  const checkout = useCallback(async (branch: string) => {
    if (!projectId) return;
    try {
      await api.post(`/git/checkout/${projectId}`, { branch });
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }, [projectId, refresh]);

  const pull = useCallback(async () => {
    if (!projectId) return;
    try {
      await api.post(`/git/pull/${projectId}`, {});
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }, [projectId, refresh]);

  const push = useCallback(async () => {
    if (!projectId) return;
    try {
      await api.post(`/git/push/${projectId}`, {});
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }, [projectId, refresh]);

  const init = useCallback(async () => {
    if (!projectId) return;
    try {
      await api.post(`/git/init/${projectId}`, {});
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }, [projectId, refresh]);

  const clone = useCallback(async (url: string) => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      await api.post(`/git/clone/${projectId}`, { url });
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, refresh]);

  const getDiff = useCallback(async (path: string, staged: boolean): Promise<GitDiffResult | null> => {
    if (!projectId) return null;
    try {
      return await api.get<GitDiffResult>(`/git/diff/${projectId}?path=${encodeURIComponent(path)}&staged=${staged}`);
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [projectId]);

  return { status, branches, log, loading, error, stage, unstage, commit, checkout, pull, push, getDiff, refresh, init, clone };
}
