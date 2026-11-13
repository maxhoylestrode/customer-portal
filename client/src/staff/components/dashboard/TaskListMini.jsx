import { Link } from 'react-router-dom';
import StatusPill from '../tasks/StatusPill';
import DueDate from '../tasks/DueDate';

// Compact task rows: status dot, name, client, due date.
export default function TaskListMini({ tasks }) {
  return (
    <ul className="-mx-2 divide-y divide-gray-50">
      {tasks.map((t) => (
        <li key={t.id}>
          <Link to={`/staff/tasks/${t.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-gray-50">
            <StatusPill compact status={t.status} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-800">{t.name}</p>
              <p className="truncate text-xs text-gray-500">{t.clientName}</p>
            </div>
            <DueDate date={t.endDate} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
