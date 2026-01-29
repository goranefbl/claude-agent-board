import React, { useState } from 'react';
import { Plus, X, Brain } from 'lucide-react';

interface Props {
  memory: { summary: string; pinned_facts: string[] } | null;
  onAddFact: (fact: string) => void;
  onRemoveFact: (index: number) => void;
  onUpdateSummary: (summary: string) => void;
  projectMemory?: { summary: string } | null;
  onUpdateProjectSummary?: (summary: string) => void;
}

export default function MemoryPanel({
  memory,
  onAddFact,
  onRemoveFact,
  onUpdateSummary,
  projectMemory,
  onUpdateProjectSummary,
}: Props) {
  const [newFact, setNewFact] = useState('');
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [editingProjectSummary, setEditingProjectSummary] = useState(false);
  const [projectSummaryDraft, setProjectSummaryDraft] = useState('');

  const hasProjectMemory = projectMemory && onUpdateProjectSummary;

  if (!hasProjectMemory && !memory) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        <Brain size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-center">No memory for this session</p>
      </div>
    );
  }

  const handleAddFact = () => {
    if (!newFact.trim()) return;
    onAddFact(newFact.trim());
    setNewFact('');
  };

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <Brain size={16} /> Memory
      </h3>

      {/* Project Memory */}
      {hasProjectMemory && (
        <div className="mb-4">
          <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Project Memory</label>
          {editingProjectSummary ? (
            <div className="mt-1">
              <textarea
                value={projectSummaryDraft}
                onChange={(e) => setProjectSummaryDraft(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white resize-none"
                rows={3}
              />
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => { onUpdateProjectSummary(projectSummaryDraft); setEditingProjectSummary(false); }}
                  className="text-xs px-2 py-1 bg-blue-600 rounded text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingProjectSummary(false)}
                  className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p
              onClick={() => { setProjectSummaryDraft(projectMemory.summary); setEditingProjectSummary(true); }}
              className="mt-1 text-xs text-gray-400 cursor-pointer hover:text-gray-300 min-h-[2em]"
            >
              {projectMemory.summary || 'Click to add project memory...'}
            </p>
          )}
        </div>
      )}

      {hasProjectMemory && memory && (
        <div className="border-t border-gray-700 my-4" />
      )}

      {/* Session Memory */}
      {memory && (
        <>
          {hasProjectMemory && (
            <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Session Memory</label>
          )}

          {/* Summary */}
          <div className="mb-4 mt-1">
            <label className="text-xs text-gray-500 uppercase tracking-wider">Summary</label>
            {editingSummary ? (
              <div className="mt-1">
                <textarea
                  value={summaryDraft}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white resize-none"
                  rows={3}
                />
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={() => { onUpdateSummary(summaryDraft); setEditingSummary(false); }}
                    className="text-xs px-2 py-1 bg-blue-600 rounded text-white"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingSummary(false)}
                    className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p
                onClick={() => { setSummaryDraft(memory.summary); setEditingSummary(true); }}
                className="mt-1 text-xs text-gray-400 cursor-pointer hover:text-gray-300 min-h-[2em]"
              >
                {memory.summary || 'Click to add summary...'}
              </p>
            )}
          </div>

          {/* Pinned Facts */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Pinned Facts</label>
            <div className="mt-1 space-y-1">
              {memory.pinned_facts.map((fact, i) => (
                <div key={i} className="flex items-start gap-1 group">
                  <span className="text-xs text-gray-400 flex-1">{fact}</span>
                  <button
                    onClick={() => onRemoveFact(i)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-1 mt-2">
              <input
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFact()}
                placeholder="Add a fact..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button onClick={handleAddFact} className="text-gray-400 hover:text-white p-1">
                <Plus size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
