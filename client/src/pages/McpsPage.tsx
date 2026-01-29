import React from 'react';
import { useMcps } from '../hooks/useMcps';
import Sidebar from '../components/layout/Sidebar';
import McpManager from '../components/mcps/McpManager';

export default function McpsPage() {
  const { mcps, create, update, remove } = useMcps();

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1117]">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <McpManager mcps={mcps} onCreate={create} onUpdate={update} onDelete={remove} />
      </div>
    </div>
  );
}
