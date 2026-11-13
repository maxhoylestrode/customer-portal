import { ChevronDown } from 'lucide-react';
import Dropdown from './Dropdown';
import { STATUSES, statusOf } from '../../constants/tasks';

// Coloured status pill. Pass `onChange` to make it a dropdown that changes the
// status. `compact` shows just the coloured dot (used at the start of rows).
export default function StatusPill({ status, onChange, compact = false }) {
  const s = statusOf(status);

  if (compact) {
    const dot = <span className={`block h-3 w-3 rounded-full ${s.dot}`} />;
    if (!onChange) return <span title={s.label}>{dot}</span>;
    return (
      <Dropdown title={`Status: ${s.label}`} trigger={dot} buttonClassName="p-1">
        {(close) => <StatusMenu current={status} onPick={(v) => { close(); onChange(v); }} />}
      </Dropdown>
    );
  }

  const pill = (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.pill}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
      {onChange && <ChevronDown className="h-3 w-3 opacity-60" />}
    </span>
  );
  if (!onChange) return pill;
  return (
    <Dropdown trigger={pill}>
      {(close) => <StatusMenu current={status} onPick={(v) => { close(); onChange(v); }} />}
    </Dropdown>
  );
}

function StatusMenu({ current, onPick }) {
  return STATUSES.map((s) => (
    <button
      key={s.value}
      type="button"
      onClick={() => s.value !== current && onPick(s.value)}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${
        s.value === current ? 'font-semibold text-brand-700' : 'text-gray-700'
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
      {s.label}
    </button>
  ));
}
