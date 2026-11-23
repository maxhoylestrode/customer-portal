import React from 'react';

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; classes: string; dot: string }> = {
  pending: { label: 'Pending', classes: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500' },
  in_progress: { label: 'In Progress', classes: 'bg-blue-50 text-blue-700 border border-blue-200', dot: 'bg-blue-500' },
  complete: { label: 'Complete', classes: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-green-500' },
  out_of_scope: { label: 'Out of Scope', classes: 'bg-gray-50 text-gray-600 border border-gray-200', dot: 'bg-gray-400' },
};

export default function StatusBadge({ status, size = 'md' }: Props) {
  const config = statusConfig[status] || { label: status, classes: 'bg-gray-50 text-gray-600 border border-gray-200', dot: 'bg-gray-400' };
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full ${sizeClasses} ${config.classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
