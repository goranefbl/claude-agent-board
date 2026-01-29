import React from 'react';
import { Settings } from 'lucide-react';
import type { Skill } from '../../../../shared/types';

interface SessionSkill extends Skill {
  enabled: number;
}

interface Props {
  skills: SessionSkill[];
  onToggle: (skillId: string, enabled: boolean) => void;
}

export default function SkillToggleList({ skills, onToggle }: Props) {
  if (skills.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        <Settings size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-center">No skills available</p>
      </div>
    );
  }

  const globalSkills = skills.filter(s => s.scope === 'global');
  const projectSkills = skills.filter(s => s.scope === 'project');

  const renderSkill = (skill: SessionSkill) => (
    <label
      key={skill.id}
      className="flex items-start gap-3 p-2 rounded hover:bg-gray-800/50 cursor-pointer"
    >
      <input
        type="checkbox"
        checked={!!skill.enabled}
        onChange={(e) => onToggle(skill.id, e.target.checked)}
        className="mt-0.5 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{skill.icon}</span>
          <span className="text-sm text-white">{skill.name}</span>
        </div>
        {skill.description && (
          <div className="text-xs text-gray-500">{skill.description}</div>
        )}
      </div>
    </label>
  );

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <Settings size={16} /> Session Skills
      </h3>
      {globalSkills.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Global</p>
          <div className="space-y-1">{globalSkills.map(renderSkill)}</div>
        </div>
      )}
      {projectSkills.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Project</p>
          <div className="space-y-1">{projectSkills.map(renderSkill)}</div>
        </div>
      )}
    </div>
  );
}
