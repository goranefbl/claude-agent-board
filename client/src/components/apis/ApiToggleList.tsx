import React from 'react';
import { Cable } from 'lucide-react';
import type { Api } from '../../../../shared/types';

interface SessionApi extends Api {
  enabled: number;
}

interface Props {
  apis: SessionApi[];
  onToggle: (apiId: string, enabled: boolean) => void;
}

export default function ApiToggleList({ apis, onToggle }: Props) {
  if (apis.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        <Cable size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-center">No APIs available</p>
      </div>
    );
  }

  const globalApis = apis.filter(a => a.scope === 'global');
  const projectApis = apis.filter(a => a.scope === 'project');

  const renderApi = (apiItem: SessionApi) => (
    <label
      key={apiItem.id}
      className="flex items-start gap-3 p-2 rounded hover:bg-gray-800/50 cursor-pointer"
    >
      <input
        type="checkbox"
        checked={!!apiItem.enabled}
        onChange={(e) => onToggle(apiItem.id, e.target.checked)}
        className="mt-0.5 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{apiItem.icon}</span>
          <span className="text-sm text-white">{apiItem.name}</span>
        </div>
        {apiItem.description && (
          <div className="text-xs text-gray-500">{apiItem.description}</div>
        )}
        <div className="text-xs text-gray-600 truncate">{apiItem.base_url}</div>
      </div>
    </label>
  );

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <Cable size={16} /> Session APIs
      </h3>
      {globalApis.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Global</p>
          <div className="space-y-1">{globalApis.map(renderApi)}</div>
        </div>
      )}
      {projectApis.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Project</p>
          <div className="space-y-1">{projectApis.map(renderApi)}</div>
        </div>
      )}
    </div>
  );
}
