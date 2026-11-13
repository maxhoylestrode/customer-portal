import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

const lines = (a) =>
  [
    a.overdueTasks > 0 && {
      key: 'overdue',
      tone: 'red',
      text: `${a.overdueTasks} ${a.overdueTasks === 1 ? 'task is' : 'tasks are'} overdue`,
      href: '/staff/tasks?overdue=1',
    },
    a.dueTodayTasks > 0 && {
      key: 'today',
      tone: 'amber',
      text: `${a.dueTodayTasks} ${a.dueTodayTasks === 1 ? 'task is' : 'tasks are'} due today`,
      href: '/staff/tasks?dueToday=1',
    },
    a.ticketsWaiting > 0 && {
      key: 'tickets',
      tone: 'amber',
      text: `${a.ticketsWaiting} ${a.ticketsWaiting === 1 ? 'ticket is' : 'tickets are'} waiting for a reply`,
      href: '/admin/tickets?status=pending',
    },
  ].filter(Boolean);

// "Does anything need me right now?" Only shows lines with something in them.
export default function AttentionPanel({ attention }) {
  const items = lines(attention);

  if (items.length === 0) {
    return (
      <div className="card flex items-center gap-3 border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        <p className="text-sm font-medium text-emerald-800">All clear. Nothing needs you right now.</p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <h2 className="mb-2 text-sm font-semibold text-brand-700">Needs attention</h2>
      <ul className="divide-y divide-gray-50">
        {items.map((i) => {
          const Icon = i.tone === 'red' ? AlertCircle : Clock;
          return (
            <li key={i.key}>
              <Link to={i.href} className="flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-gray-50">
                <Icon className={`h-4 w-4 shrink-0 ${i.tone === 'red' ? 'text-red-500' : 'text-amber-500'}`} />
                <span className={`flex-1 text-sm ${i.tone === 'red' ? 'font-medium text-red-600' : 'text-gray-700'}`}>{i.text}</span>
                <span className="text-xs text-brand-600">View →</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
