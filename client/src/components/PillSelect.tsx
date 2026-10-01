import React from 'react';
import { Check } from 'lucide-react';

export interface PillOption {
  value: string;
  label: string;
  // Classes for the selected pill, and the dot shown on unselected ones
  selected: string;
  dot: string;
}

export default function PillSelect({
  label,
  options,
  value,
  original,
  onChange,
}: {
  label: string;
  options: PillOption[];
  value: string;
  original: string;
  onChange: (value: string) => void;
}) {
  const changed = value !== original;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="label text-xs mb-0">{label}</span>
        {changed && <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Changed</span>}
      </div>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                active
                  ? `${opt.selected} shadow-sm ${changed ? 'ring-2 ring-amber-300 ring-offset-1' : ''}`
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {active ? <Check className="h-3 w-3" /> : <span className={`h-2 w-2 rounded-full ${opt.dot}`} />}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const STATUS_OPTIONS: PillOption[] = [
  { value: 'pending', label: 'Pending', selected: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-400' },
  { value: 'in_progress', label: 'In Progress', selected: 'bg-blue-100 text-blue-800 border-blue-300', dot: 'bg-blue-500' },
  { value: 'complete', label: 'Complete', selected: 'bg-green-100 text-green-800 border-green-300', dot: 'bg-green-500' },
  { value: 'out_of_scope', label: 'Out of Scope', selected: 'bg-gray-200 text-gray-700 border-gray-300', dot: 'bg-gray-400' },
];

export const SCOPE_OPTIONS: PillOption[] = [
  { value: 'unknown', label: 'Unknown', selected: 'bg-gray-200 text-gray-700 border-gray-300', dot: 'bg-gray-400' },
  { value: 'in_scope', label: 'In Scope', selected: 'bg-green-100 text-green-800 border-green-300', dot: 'bg-green-500' },
  { value: 'out_of_scope', label: 'Out of Scope', selected: 'bg-orange-100 text-orange-800 border-orange-300', dot: 'bg-orange-400' },
];

export const PRIORITY_OPTIONS: PillOption[] = [
  { value: 'low', label: 'Low', selected: 'bg-gray-200 text-gray-700 border-gray-300', dot: 'bg-gray-400' },
  { value: 'normal', label: 'Normal', selected: 'bg-blue-100 text-blue-800 border-blue-300', dot: 'bg-blue-500' },
  { value: 'high', label: 'High', selected: 'bg-red-100 text-red-700 border-red-300', dot: 'bg-red-500' },
];
