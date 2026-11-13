import { Link } from 'react-router-dom';

// Per person: name, a thin bar relative to the busiest person, "6 open · 1 overdue".
export default function WorkloadBars({ people }) {
  const max = Math.max(...people.map((p) => p.open), 1);
  return (
    <ul className="space-y-3">
      {people.map((p) => (
        <li key={p.userId}>
          <Link to={`/staff/tasks?assignedUserId=${p.userId}`} className="group block">
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium text-gray-800 group-hover:text-brand-600">{p.name}</span>
              <span className="text-xs text-gray-500">
                {p.open} open
                {p.overdue > 0 && <span className="font-medium text-red-500"> · {p.overdue} overdue</span>}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div className="h-1.5 rounded-full bg-brand-600 transition-all" style={{ width: `${(p.open / max) * 100}%` }} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
