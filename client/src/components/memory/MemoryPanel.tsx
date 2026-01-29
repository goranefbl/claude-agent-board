import React, { useState } from 'react';
import { Brain } from 'lucide-react';

interface Props {
  memory: { summary: string } | null;
  projectMemory?: { summary: string } | null;
  onUpdateProjectSummary?: (summary: string) => void;
}

function SummaryEditor({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  return (
    <div>
      <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{label}</label>
      {editing ? (
        <div className="mt-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white resize-none"
            rows={3}
            autoFocus
          />
          <div className="flex gap-1 mt-1">
            <button
              onClick={() => { onSave(draft); setEditing(false); }}
              className="text-xs px-2 py-1 bg-blue-600 rounded text-white"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p
          onClick={() => { setDraft(value); setEditing(true); }}
          className="mt-1 text-xs text-gray-400 cursor-pointer hover:text-gray-300 min-h-[2em] whitespace-pre-wrap"
        >
          {value || 'Click to edit...'}
        </p>
      )}
    </div>
  );
}

export default function MemoryPanel({
  memory,
  projectMemory,
  onUpdateProjectSummary,
}: Props) {
  const hasProjectMemory = projectMemory && onUpdateProjectSummary;

  if (!hasProjectMemory && !memory) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        <Brain size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-center">No memory for this session</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <Brain size={16} /> Memory
      </h3>

      {hasProjectMemory && (
        <SummaryEditor
          label="Project Memory"
          value={projectMemory.summary}
          onSave={onUpdateProjectSummary}
        />
      )}

      {hasProjectMemory && memory && (
        <div className="border-t border-gray-700 my-4" />
      )}

      {memory && (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
            {hasProjectMemory ? 'Session Memory' : 'Memory'}
          </label>
          <p className="mt-1 text-xs text-gray-400 min-h-[2em] whitespace-pre-wrap">
            {memory.summary || 'Auto-generated after conversation activity.'}
          </p>
        </div>
      )}
    </div>
  );
}
