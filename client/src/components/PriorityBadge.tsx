import React from 'react';

interface Props {
  priority: string;
}

const config: Record<string, { label: string; classes: string }> = {
  low: { label: 'Low', classes: 'bg-gray-100 text-gray-500 border border-gray-200' },
  normal: { label: 'Normal', classes: 'bg-blue-50 text-blue-600 border border-blue-100' },
  high: { label: 'High', classes: 'bg-red-100 text-red-700 border border-red-200' },
};

export default function PriorityBadge({ priority }: Props) {
  const c = config[priority] || config.normal;
  return (
    <span className={`inline-flex items-center text-xs font-medium rounded-full px-2.5 py-1 ${c.classes}`}>
      {c.label}
    </span>
  );
}
