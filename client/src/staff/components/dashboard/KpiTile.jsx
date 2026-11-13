import { Link } from 'react-router-dom';

// One headline number with a plain-English line of context. The whole tile is a link.
export default function KpiTile({ kpi }) {
  const tone =
    kpi.trend === 'up'
      ? 'text-emerald-600'
      : kpi.trend === 'down'
        ? 'text-red-500'
        : kpi.key === 'myOpenTasks' && /^\d+ overdue/.test(kpi.context)
          ? 'text-red-500'
          : 'text-gray-500';

  return (
    <Link
      to={kpi.href}
      className="card block p-5 transition hover:border-brand-300 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
    >
      <p className="text-sm text-gray-500">{kpi.label}</p>
      <p className="mt-1 text-3xl font-bold text-brand-700">{kpi.value}</p>
      <p className={`mt-1 text-xs ${tone}`}>{kpi.context}</p>
    </Link>
  );
}
