import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, FileCode } from 'lucide-react';
import type { TreeNode } from '../../hooks/useFiles';

const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h',
  'css', 'scss', 'html', 'vue', 'svelte', 'json', 'yaml', 'yml', 'toml', 'md',
  'sh', 'bash', 'sql', 'graphql', 'php', 'swift', 'kt',
]);

function isCodeFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return CODE_EXTENSIONS.has(ext);
}

interface ContextMenu {
  x: number;
  y: number;
  node: TreeNode | null; // null = root level
}

interface FileTreeNodeProps {
  node: TreeNode;
  depth: number;
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
}

function FileTreeNode({ node, depth, activeFile, onSelectFile, onContextMenu }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDir = node.type === 'dir';
  const isActive = node.path === activeFile;

  const handleClick = () => {
    if (isDir) {
      setExpanded(!expanded);
    } else {
      onSelectFile(node.path);
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer text-sm hover:bg-gray-800/50 ${
          isActive ? 'bg-gray-800 text-white' : 'text-gray-400'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {isDir ? (
          <>
            {expanded ? <ChevronDown size={14} className="shrink-0 text-gray-500" /> : <ChevronRight size={14} className="shrink-0 text-gray-500" />}
            {expanded ? <FolderOpen size={14} className="shrink-0 text-accent-500" /> : <Folder size={14} className="shrink-0 text-accent-500" />}
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            {isCodeFile(node.name) ? <FileCode size={14} className="shrink-0 text-blue-400" /> : <File size={14} className="shrink-0 text-gray-500" />}
          </>
        )}
        <span className="truncate">{node.name}</span>
      </div>
      {isDir && expanded && node.children?.map((child) => (
        <FileTreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          activeFile={activeFile}
          onSelectFile={onSelectFile}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}

interface Props {
  tree: TreeNode[];
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  onCreateItem: (parentPath: string, type: 'file' | 'dir') => void;
  onDeleteItem: (path: string) => void;
}

export default function FileTree({ tree, activeFile, onSelectFile, onCreateItem, onDeleteItem }: Props) {
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleRootContextMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-tree-node]')) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node: null });
  };

  const menuAction = (action: string) => {
    if (!contextMenu) return;
    const node = contextMenu.node;
    const parentPath = node ? (node.type === 'dir' ? node.path : node.path.split('/').slice(0, -1).join('/')) : '';

    switch (action) {
      case 'new-file':
        onCreateItem(parentPath, 'file');
        break;
      case 'new-folder':
        onCreateItem(parentPath, 'dir');
        break;
      case 'delete':
        if (node) onDeleteItem(node.path);
        break;
    }
    setContextMenu(null);
  };

  return (
    <div
      className="h-full overflow-y-auto py-1 select-none"
      onContextMenu={handleRootContextMenu}
    >
      {tree.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={0}
          activeFile={activeFile}
          onSelectFile={onSelectFile}
          onContextMenu={handleContextMenu}
        />
      ))}
      {tree.length === 0 && (
        <div className="text-gray-600 text-xs px-4 py-8 text-center">
          No files found
        </div>
      )}

      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-[#1c2128] border border-gray-700 rounded shadow-lg py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700/50"
            onClick={() => menuAction('new-file')}
          >
            New File
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700/50"
            onClick={() => menuAction('new-folder')}
          >
            New Folder
          </button>
          {contextMenu.node && (
            <>
              <div className="border-t border-gray-700 my-1" />
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700/50"
                onClick={() => menuAction('delete')}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
