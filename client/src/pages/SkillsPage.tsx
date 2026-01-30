import React from 'react';
import { useSkills } from '../hooks/useSkills';
import Sidebar from '../components/layout/Sidebar';
import SkillManager from '../components/skills/SkillManager';

export default function SkillsPage() {
  const { skills, create, update, remove } = useSkills();

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1117]">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <SkillManager skills={skills} onCreate={create} onUpdate={update} onDelete={remove} />
      </div>
    </div>
  );
}
