// Six small vertical bars with the value above and the month below. Plain CSS, no chart library.
export default function MonthBars({ data }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-28 items-end gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end">
          <span className="mb-1 text-xs font-semibold text-brand-700">{d.count}</span>
          <div
            className={`w-full max-w-[2rem] rounded-t ${d.count === 0 ? 'bg-gray-200' : 'bg-brand-600'}`}
            style={{ height: `${d.count === 0 ? 4 : Math.max((d.count / max) * 72, 8)}px` }}
          />
          <span className="mt-1.5 text-[11px] text-gray-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
