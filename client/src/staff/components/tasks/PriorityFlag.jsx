import { Flag } from 'lucide-react';
import Dropdown from './Dropdown';
import { PRIORITIES, priorityOf } from '../../constants/tasks';

// Flag icon coloured by priority. Pass `onChange` to make it a dropdown.
export default function PriorityFlag({ priority, onChange, showLabel = true }) {
  const p = priorityOf(priority);
  const content = (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${p.text}`}>
      <Flag className="h-3.5 w-3.5" fill="currentColor" />
      {showLabel && p.label}
    </span>
  );
  if (!onChange) return content;
  return (
    <Dropdown trigger={content} buttonClassName="px-1 py-0.5">
      {(close) =>
        PRIORITIES.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              close();
              if (o.value !== priority) onChange(o.value);
            }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${
              o.value === priority ? 'font-semibold' : ''
            } ${o.text}`}
          >
            <Flag className="h-3.5 w-3.5" fill="currentColor" />
            {o.label}
          </button>
        ))
      }
    </Dropdown>
  );
}
