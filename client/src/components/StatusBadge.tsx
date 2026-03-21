import React from 'react';

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; classes: string }> = {
  pending: { label: 'Pending', classes: 'bg-amber-100 text-amber-800 border border-amber-200' },
  in_progress: { label: 'In Progress', classes: 'bg-blue-100 text-blue-800 border border-blue-200' },
  complete: { label: 'Complete', classes: 'bg-green-100 text-green-800 border border-green-200' },
  out_of_scope: { label: 'Out of Scope', classes: 'bg-gray-100 text-gray-600 border border-gray-200' },
};

export default function StatusBadge({ status, size = 'md' }: Props) {
  const config = statusConfig[status] || { label: status, classes: 'bg-gray-100 text-gray-600' };
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${sizeClasses} ${config.classes}`}>
      {config.label}
    </span>
  );
}
