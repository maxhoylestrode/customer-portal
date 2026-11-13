// One horizontal bar split into coloured segments, with a legend underneath.
// segments: [{ label, value, color }]  (color is a CSS colour)
export default function StackedBar({ segments, emptyLabel = 'Nothing yet' }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div
                key={s.label}
                title={`${s.label}: ${s.value}`}
                style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
              />
            ))}
      </div>
      {total === 0 ? (
        <p className="mt-2 text-xs text-gray-400">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label} <span className="font-semibold text-brand-700">{s.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
