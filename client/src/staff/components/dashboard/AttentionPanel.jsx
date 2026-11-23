import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

const lines = (a) =>
  [
    a.overdueTasks > 0 && {
      key: 'overdue',
      tone: 'red',
      text: `${a.overdueTasks} ${a.overdueTasks === 1 ? 'task' : 'tasks'} overdue`,
      href: '/staff/tasks?overdue=1',
    },
    a.dueTodayTasks > 0 && {
      key: 'today',
      tone: 'amber',
      text: `${a.dueTodayTasks} due today`,
      href: '/staff/tasks?dueToday=1',
    },
    a.ticketsWaiting > 0 && {
      key: 'tickets',
      tone: 'amber',
      text: `${a.ticketsWaiting} ${a.ticketsWaiting === 1 ? 'ticket' : 'tickets'} waiting for a reply`,
      href: '/admin/tickets?status=pending',
    },
  ].filter(Boolean);

const TONES = {
  red: 'border-red-200 bg-red-50 text-red-700 hover:border-red-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300',
};

// "Does anything need me right now?" as a row of chips under the greeting.
export default function AttentionPanel({ attention }) {
  const items = lines(attention);

  if (items.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        All clear, nothing needs you right now
      </span>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Needs attention">
      {items.map((i) => {
        const Icon = i.tone === 'red' ? AlertCircle : Clock;
        return (
          <li key={i.key}>
            <Link
              to={i.href}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${TONES[i.tone]}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {i.text}
              <span aria-hidden className="opacity-60">→</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
