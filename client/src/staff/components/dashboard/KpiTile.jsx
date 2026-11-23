import { Link } from 'react-router-dom';

// One cell of the stat strip: small label, the number, and a short line of context.
export default function KpiTile({ kpi }) {
  const tone = kpi.alert
    ? 'text-red-500'
    : kpi.trend === 'up'
      ? 'text-emerald-600'
      : kpi.trend === 'down'
        ? 'text-amber-600'
        : 'text-gray-500';

  return (
    <Link
      to={kpi.href}
      className="group block px-4 py-3 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500 group-hover:text-gray-700">{kpi.label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="num text-xl font-semibold text-gray-900">{kpi.value}</span>
        <span className={`truncate text-xs ${tone}`}>{kpi.context}</span>
      </div>
    </Link>
  );
}

// The strip itself: one card, cells split by 1px gaps showing the border colour through.
export function KpiStrip({ kpis, children }) {
  return (
    <section className="card overflow-hidden">
      <div className={`grid gap-px bg-line ${kpis.length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
        {kpis.map((k) => (
          <div key={k.key} className="bg-white">
            <KpiTile kpi={k} />
          </div>
        ))}
      </div>
      {children && <div className="border-t border-line px-4 py-3">{children}</div>}
    </section>
  );
}
