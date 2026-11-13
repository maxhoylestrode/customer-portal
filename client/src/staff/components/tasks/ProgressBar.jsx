// Thin progress bar. `showLabel` adds the percentage on the right.
export default function ProgressBar({ value = 0, showLabel = false, className = '' }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-brand-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="w-9 text-right text-xs text-gray-500">{pct}%</span>}
    </div>
  );
}
