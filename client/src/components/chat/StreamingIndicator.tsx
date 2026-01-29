import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Globe, Terminal, Search, FileText, Loader } from 'lucide-react';

interface ToolActivity {
  type: 'use' | 'result';
  tool: string;
  input?: Record<string, unknown>;
  result?: string;
}

interface Props {
  content: string;
  toolActivities: ToolActivity[];
}

const toolIcons: Record<string, React.ReactNode> = {
  WebFetch: <Globe size={14} />,
  WebSearch: <Search size={14} />,
  Bash: <Terminal size={14} />,
  Read: <FileText size={14} />,
};

function getToolIcon(tool: string) {
  return toolIcons[tool] || <Terminal size={14} />;
}

function getToolLabel(activity: ToolActivity): string {
  if (activity.tool === 'WebFetch' && activity.input?.url) {
    return `Fetching ${activity.input.url}`;
  }
  if (activity.tool === 'WebSearch' && activity.input?.query) {
    return `Searching: ${activity.input.query}`;
  }
  if (activity.tool === 'Bash' && activity.input?.command) {
    const cmd = String(activity.input.command);
    return `Running: ${cmd.length > 60 ? cmd.substring(0, 60) + '...' : cmd}`;
  }
  if (activity.tool === 'Read' && activity.input?.file_path) {
    return `Reading: ${activity.input.file_path}`;
  }
  return `Using ${activity.tool}`;
}

export default function StreamingIndicator({ content, toolActivities }: Props) {
  const hasToolActivity = toolActivities.length > 0;

  if (!content && !hasToolActivity) {
    return (
      <div className="flex justify-start mb-4">
        <div className="bg-[#161b22] border border-gray-800/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%] bg-[#161b22] border border-gray-800/50 text-gray-200 rounded-lg px-4 py-3">
        {/* Tool activities */}
        {hasToolActivity && (
          <div className="mb-2 space-y-1">
            {toolActivities.map((activity, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                  activity.type === 'use'
                    ? 'bg-amber-900/20 text-amber-300 border border-amber-800/30'
                    : 'bg-green-900/20 text-green-300 border border-green-800/30'
                }`}
              >
                {activity.type === 'use' ? (
                  <>
                    {getToolIcon(activity.tool)}
                    <span>{getToolLabel(activity)}</span>
                    {i === toolActivities.length - 1 && activity.type === 'use' && (
                      <Loader size={12} className="animate-spin ml-auto" />
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-green-400">Done</span>
                    <span className="truncate">{activity.result?.substring(0, 80)}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Streaming text */}
        {content && (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}

        <div className="mt-1">
          <span className="inline-block w-2 h-4 bg-amber-500 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
