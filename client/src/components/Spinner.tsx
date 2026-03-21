import React from 'react';

export default function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
  );
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Spinner className="w-8 h-8 text-[#0D3040]" />
    </div>
  );
}
