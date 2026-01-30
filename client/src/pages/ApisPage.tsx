import React from 'react';
import { useApis } from '../hooks/useApis';
import Sidebar from '../components/layout/Sidebar';
import ApiManager from '../components/apis/ApiManager';

export default function ApisPage() {
  const { apis, create, update, remove } = useApis();

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1117]">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <ApiManager apis={apis} onCreate={create} onUpdate={update} onDelete={remove} />
      </div>
    </div>
  );
}
