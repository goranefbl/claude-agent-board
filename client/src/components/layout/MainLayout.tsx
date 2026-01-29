import React from 'react';

interface Props {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
}

export default function MainLayout({ sidebar, header, children, rightPanel }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1117]">
      {sidebar}
      <div className="flex-1 flex flex-col min-w-0">
        {header}
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-hidden">{children}</main>
          {rightPanel && (
            <aside className="w-80 border-l border-gray-800/50 bg-[#0d1117] overflow-y-auto">
              {rightPanel}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
