import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Terminal,
  Search,
  FileText,
  FileEdit,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Brain,
} from 'lucide-react';

interface ToolInteraction {
  tool: string;
  input: Record<string, unknown>;
  result?: string;
}

interface Props {
  activities: ToolInteraction[];
}

function getToolIcon(tool: string) {
  switch (tool) {
    case 'WebFetch': return <Globe size={14} className="shrink-0" />;
    case 'WebSearch': return <Search size={14} className="shrink-0" />;
    case 'Bash': return <Terminal size={14} className="shrink-0" />;
    case 'Read': return <FileText size={14} className="shrink-0" />;
    case 'Write': case 'Edit': return <FileEdit size={14} className="shrink-0" />;
    default: return <Terminal size={14} className="shrink-0" />;
  }
}

function getToolLabel(tool: string, input: Record<string, unknown>): string {
  if (tool === 'WebFetch' && input.url) return String(input.url);
  if (tool === 'WebSearch' && input.query) return String(input.query);
  if (tool === 'Bash' && input.command) {
    const cmd = String(input.command);
    return cmd.length > 80 ? cmd.substring(0, 80) + '...' : cmd;
  }
  if (tool === 'Read' && input.file_path) return String(input.file_path);
  if (tool === 'Write' && input.file_path) return String(input.file_path);
  if (tool === 'Edit' && input.file_path) return String(input.file_path);
  if (tool === 'Grep' && input.pattern) return `/${input.pattern}/`;
  if (tool === 'Glob' && input.pattern) return String(input.pattern);
  return tool;
}

function isError(result?: string): boolean {
  if (!result) return false;
  const lower = result.toLowerCase();
  return (
    lower.includes('<tool_use_error>') ||
    lower.includes('error:') ||
    lower.includes('exit code 1') ||
    lower.includes('command failed') ||
    lower.includes('file does not exist') ||
    lower.includes('permission denied')
  );
}

function getErrorMessage(result: string): string | null {
  // Extract error from tool_use_error tags
  const match = result.match(/<tool_use_error>(.*?)<\/tool_use_error>/s);
  if (match) return match[1].trim();
  // Extract first line containing 'error'
  const lines = result.split('\n');
  const errorLine = lines.find(l => /error/i.test(l));
  if (errorLine) return errorLine.trim().substring(0, 120);
  return null;
}

function getWriteLineCount(input: Record<string, unknown>): number | null {
  if (input.content && typeof input.content === 'string') {
    return input.content.split('\n').length;
  }
  return null;
}

export default function ActivityLog({ activities }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (activities.length === 0) return null;

  const errorCount = activities.filter(a => isError(a.result)).length;

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 transition-colors py-1"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded text-[11px] font-medium">
          {activities.length}
        </span>
        <span>Steps Completed</span>
        {errorCount > 0 && (
          <span className="text-red-400 flex items-center gap-1">
            <AlertCircle size={12} />
            {errorCount} {errorCount === 1 ? 'error' : 'errors'}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-1.5 space-y-0.5 border-l-2 border-gray-800 ml-1.5 pl-3">
          {activities.map((activity, i) => {
            const hasError = isError(activity.result);
            const errorMsg = hasError && activity.result ? getErrorMessage(activity.result) : null;
            const lineCount = (activity.tool === 'Write' || activity.tool === 'Edit') ? getWriteLineCount(activity.input) : null;

            return (
              <div key={i} className="flex items-center gap-2 py-0.5 text-xs">
                {hasError ? (
                  <XCircle size={14} className="text-red-400 shrink-0" />
                ) : (
                  <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                )}
                <span className="text-gray-500 font-medium shrink-0">{activity.tool}</span>
                {lineCount && (
                  <span className="bg-green-900/30 text-green-400 text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0">
                    {lineCount}
                  </span>
                )}
                <span className="text-gray-500 truncate">
                  {getToolLabel(activity.tool, activity.input)}
                </span>
                {errorMsg && (
                  <span className="text-red-400 truncate ml-1">
                    {errorMsg}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
