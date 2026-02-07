import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ActivityLog from './ActivityLog';
import type { Message } from '../../../../shared/types';

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  const toolActivities = useMemo(() => {
    if (!message.tool_use || isUser) return [];
    try {
      return JSON.parse(message.tool_use) as { tool: string; input: Record<string, unknown>; result?: string }[];
    } catch {
      return [];
    }
  }, [message.tool_use, isUser]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-4 py-3 overflow-hidden ${
          isUser
            ? 'bg-accent-600/90 text-white'
            : 'bg-[#161b22] border border-gray-800/50 text-gray-200'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {toolActivities.length > 0 && (
              <ActivityLog activities={toolActivities} />
            )}
            <div className="prose prose-invert prose-sm max-w-none overflow-x-auto
              prose-p:my-2 prose-p:leading-relaxed
              prose-headings:mt-4 prose-headings:mb-2
              prose-ul:my-2 prose-ol:my-2
              prose-li:my-0.5
              prose-pre:my-3 prose-pre:rounded-md prose-pre:border prose-pre:border-gray-800/50 prose-pre:overflow-x-auto
              prose-code:text-accent-300/90 prose-code:font-normal
              prose-code:before:content-[''] prose-code:after:content-['']
              prose-a:text-accent-400 prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-gray-700 prose-blockquote:text-gray-400
              prose-strong:text-gray-100
              prose-hr:border-gray-800
            ">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ children, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </>
        )}
        <div className={`text-xs mt-2 flex items-center gap-2 ${isUser ? 'text-accent-200/70' : 'text-gray-600'}`}>
          <span>{new Date(message.created_at).toLocaleTimeString()}</span>
          {!isUser && message.interrupted === 1 && (
            <span className="italic text-yellow-500/70">[stopped]</span>
          )}
        </div>
      </div>
    </div>
  );
}
