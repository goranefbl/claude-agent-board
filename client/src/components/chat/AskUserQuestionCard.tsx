import React from 'react';
import { HelpCircle, Star } from 'lucide-react';

interface QuestionOption {
  label: string;
  description?: string;
}

interface Question {
  question: string;
  header?: string;
  multiSelect?: boolean;
  options: QuestionOption[];
}

interface Props {
  questions: Question[];
}

// "(Recommended)" suffix convention marks the recommended option.
function isRecommended(label: string): boolean {
  return /\(recommended\)/i.test(label);
}

function stripRecommended(label: string): string {
  return label.replace(/\s*\(recommended\)\s*$/i, '').trim();
}

// Tolerate malformed payloads: `questions` can arrive as a double-encoded JSON
// string or a non-array, which would otherwise crash the page on `.map`.
function normalizeQuestions(input: unknown): Question[] {
  let value: unknown = input;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? (value as Question[]) : [];
}

export default function AskUserQuestionCard({ questions }: Props) {
  const normalized = normalizeQuestions(questions);
  if (normalized.length === 0) return null;

  return (
    <div className="mb-3 space-y-3">
      {normalized.map((q, qi) => (
        <div key={qi} className="rounded-lg border border-accent-600/40 bg-accent-600/5">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-accent-600/30">
            <HelpCircle size={14} className="text-accent-400 shrink-0" />
            {q.header && (
              <span className="bg-accent-600/20 text-accent-300 px-1.5 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide">
                {q.header}
              </span>
            )}
            {q.multiSelect && (
              <span className="text-[10px] text-gray-500">multi-select</span>
            )}
          </div>
          <div className="px-3 py-2.5">
            <p className="text-sm text-gray-200 font-medium mb-2.5">{q.question}</p>
            <div className="space-y-1.5">
              {(Array.isArray(q.options) ? q.options : []).map((opt, oi) => {
                const recommended = isRecommended(opt.label);
                return (
                  <div
                    key={oi}
                    className={`rounded-md border px-2.5 py-2 ${
                      recommended
                        ? 'border-accent-500/50 bg-accent-600/10'
                        : 'border-gray-800/60 bg-[#0d1117]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {recommended && <Star size={12} className="text-accent-400 shrink-0 fill-accent-400" />}
                      <span className="text-sm text-gray-100 font-medium">
                        {stripRecommended(opt.label)}
                      </span>
                      {recommended && (
                        <span className="text-[10px] text-accent-400 font-medium">Recommended</span>
                      )}
                    </div>
                    {opt.description && (
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{opt.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
