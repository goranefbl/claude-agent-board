import React from 'react';
import { Settings } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';

export default function ConfigPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1117]">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-6">Config</h2>
          <div className="text-center py-16 text-gray-500">
            <Settings size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg mb-1">Configuration</p>
            <p className="text-sm">Coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
