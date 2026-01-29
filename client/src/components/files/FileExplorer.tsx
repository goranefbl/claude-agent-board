import React, { useState, useEffect, useCallback } from 'react';
import { X, Circle } from 'lucide-react';
import { useFiles } from '../../hooks/useFiles';
import FileTree from './FileTree';
import CodeEditor from './CodeEditor';

interface OpenFile {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  dirty: boolean;
}

interface Props {
  projectId: string;
}

export default function FileExplorer({ projectId }: Props) {
  const { tree, fetchTree, readFile, writeFile, createItem, deleteItem } = useFiles(projectId);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const activeFile = openFiles.find((f) => f.path === activeFilePath) || null;

  const handleSelectFile = useCallback(async (path: string) => {
    // Already open? Just activate
    const existing = openFiles.find((f) => f.path === path);
    if (existing) {
      setActiveFilePath(path);
      return;
    }
    // Load file
    const data = await readFile(path);
    if (!data) return;
    const name = path.split('/').pop() || path;
    setOpenFiles((prev) => [...prev, {
      path,
      name,
      content: data.content,
      originalContent: data.content,
      dirty: false,
    }]);
    setActiveFilePath(path);
  }, [openFiles, readFile]);

  const handleCloseFile = useCallback((path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenFiles((prev) => prev.filter((f) => f.path !== path));
    if (activeFilePath === path) {
      setActiveFilePath((prev) => {
        const remaining = openFiles.filter((f) => f.path !== path);
        return remaining.length > 0 ? remaining[remaining.length - 1].path : null;
      });
    }
  }, [activeFilePath, openFiles]);

  const handleContentChange = useCallback((content: string) => {
    if (!activeFilePath) return;
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.path === activeFilePath
          ? { ...f, content, dirty: content !== f.originalContent }
          : f
      )
    );
  }, [activeFilePath]);

  const handleSave = useCallback(async () => {
    if (!activeFile || !activeFile.dirty) return;
    const ok = await writeFile(activeFile.path, activeFile.content);
    if (ok) {
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.path === activeFile.path
            ? { ...f, originalContent: f.content, dirty: false }
            : f
        )
      );
    }
  }, [activeFile, writeFile]);

  const handleCreateItem = useCallback(async (parentPath: string, type: 'file' | 'dir') => {
    const name = prompt(type === 'dir' ? 'Folder name:' : 'File name:');
    if (!name) return;
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    await createItem(fullPath, type);
  }, [createItem]);

  const handleDeleteItem = useCallback(async (path: string) => {
    if (!confirm(`Delete "${path}"?`)) return;
    const ok = await deleteItem(path);
    if (ok) {
      // Close if open
      handleCloseFile(path);
    }
  }, [deleteItem, handleCloseFile]);

  return (
    <div className="flex h-full">
      {/* File tree panel */}
      <div className="w-64 border-r border-gray-800/50 bg-[#0d1117] flex flex-col shrink-0">
        <div className="h-8 flex items-center px-3 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800/50 font-medium">
          Explorer
        </div>
        <FileTree
          tree={tree}
          activeFile={activeFilePath}
          onSelectFile={handleSelectFile}
          onCreateItem={handleCreateItem}
          onDeleteItem={handleDeleteItem}
        />
      </div>

      {/* Editor panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Editor tabs */}
        {openFiles.length > 0 && (
          <div className="flex bg-[#161b22] border-b border-gray-800/50 overflow-x-auto">
            {openFiles.map((file) => (
              <div
                key={file.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-gray-800/50 shrink-0 ${
                  file.path === activeFilePath
                    ? 'bg-[#0d1117] text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                onClick={() => setActiveFilePath(file.path)}
              >
                {file.dirty && <Circle size={8} className="text-accent-500 fill-accent-500" />}
                <span>{file.name}</span>
                <button
                  className="ml-1 hover:text-white p-0.5 rounded hover:bg-gray-700/50"
                  onClick={(e) => handleCloseFile(file.path, e)}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Editor content */}
        <div className="flex-1 overflow-hidden">
          {activeFile ? (
            <CodeEditor
              content={activeFile.content}
              filename={activeFile.name}
              onChange={handleContentChange}
              onSave={handleSave}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              Select a file to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
