import { useState, useCallback } from 'react';
import { api } from '../api/http';

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: TreeNode[];
}

interface FileContent {
  content: string;
  path: string;
  size: number;
}

export function useFiles(projectId: string | null) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTree = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await api.get<TreeNode[]>(`/files/tree/${projectId}`);
      setTree(data);
    } catch (err) {
      console.error('Failed to fetch tree:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const readFile = useCallback(async (path: string): Promise<FileContent | null> => {
    if (!projectId) return null;
    try {
      return await api.get<FileContent>(`/files/read/${projectId}?path=${encodeURIComponent(path)}`);
    } catch (err) {
      console.error('Failed to read file:', err);
      return null;
    }
  }, [projectId]);

  const writeFile = useCallback(async (path: string, content: string): Promise<boolean> => {
    if (!projectId) return false;
    try {
      await api.put(`/files/write/${projectId}`, { path, content });
      return true;
    } catch (err) {
      console.error('Failed to write file:', err);
      return false;
    }
  }, [projectId]);

  const createItem = useCallback(async (path: string, type: 'file' | 'dir'): Promise<boolean> => {
    if (!projectId) return false;
    try {
      await api.post(`/files/create/${projectId}`, { path, type });
      await fetchTree();
      return true;
    } catch (err) {
      console.error('Failed to create item:', err);
      return false;
    }
  }, [projectId, fetchTree]);

  const deleteItem = useCallback(async (path: string): Promise<boolean> => {
    if (!projectId) return false;
    try {
      await api.del(`/files/delete/${projectId}?path=${encodeURIComponent(path)}`);
      await fetchTree();
      return true;
    } catch (err) {
      console.error('Failed to delete item:', err);
      return false;
    }
  }, [projectId, fetchTree]);

  return { tree, loading, fetchTree, readFile, writeFile, createItem, deleteItem };
}
