import { dueState, formatDay } from '../../constants/tasks';

// "14 Nov" with colour: red if overdue, amber if due today or within 3 days, grey otherwise.
export default function DueDate({ date, complete = false, className = '' }) {
  const state = dueState(date, complete);
  if (state === 'none') return <span className={`text-xs text-gray-400 ${className}`}>No date</span>;

  const colour = {
    overdue: 'text-red-600 font-medium',
    today: 'text-amber-600 font-medium',
    soon: 'text-amber-600',
    ok: 'text-gray-500',
  }[state];
  const day = <span className="num">{formatDay(date)}</span>;
  const text = state === 'overdue' ? <>Overdue · {day}</> : state === 'today' ? 'Today' : day;
  return (
    <span className={`whitespace-nowrap text-xs ${colour} ${className}`} title={formatDay(date, true)}>
      {text}
    </span>
  );
}
