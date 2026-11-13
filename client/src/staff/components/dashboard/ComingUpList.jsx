import { Link } from 'react-router-dom';
import { CalendarClock, CheckSquare, Flag } from 'lucide-react';
import { dayKey, todayKey } from '../../constants/tasks';

const KIND_ICON = { task: CheckSquare, milestone: Flag, meeting: CalendarClock };

// Date block: "Today" in the brand colour, otherwise "FRI / 14".
function DateBlock({ iso }) {
  const key = dayKey(iso);
  if (key === todayKey()) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-[11px] font-semibold uppercase text-white">
        Today
      </div>
    );
  }
  const d = new Date(key);
  return (
    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-gray-100 leading-tight">
      <span className="text-[10px] font-semibold uppercase text-gray-500">
        {d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}
      </span>
      <span className="text-sm font-bold text-brand-700">{d.getUTCDate()}</span>
    </div>
  );
}

export default function ComingUpList({ items }) {
  return (
    <ul className="-mx-2 divide-y divide-gray-50">
      {items.map((i) => {
        const Icon = KIND_ICON[i.kind] || CheckSquare;
        return (
          <li key={`${i.kind}-${i.id}`}>
            <Link to={i.href} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
              <DateBlock iso={i.date} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">{i.title}</p>
                <p className="truncate text-xs text-gray-500">{i.subtitle}</p>
              </div>
              <Icon className="h-4 w-4 shrink-0 text-gray-300" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
