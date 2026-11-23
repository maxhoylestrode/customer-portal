// Six small vertical bars with the value above and the month below. Plain CSS, no chart library.
export default function MonthBars({ data }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-20 items-end gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end">
          <span className="num mb-1 text-[11px] text-gray-500">{d.count}</span>
          <div
            className={`w-full max-w-[2rem] rounded-t ${d.count === 0 ? 'bg-gray-200' : 'bg-brand-600'}`}
            style={{ height: `${d.count === 0 ? 4 : Math.max((d.count / max) * 44, 6)}px` }}
          />
          <span className="mt-1.5 text-[11px] text-gray-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
