import { Check, UserPlus } from 'lucide-react';
import Dropdown from './Dropdown';
import AssigneeAvatars from './AssigneeAvatars';
import useStaffUsers from '../../hooks/useStaffUsers';

// Multi-select of staff. `value` is an array of user ids; `onChange` gets the new array.
export default function AssigneePicker({ value = [], onChange }) {
  const users = useStaffUsers();
  const selected = users.filter((u) => value.includes(u.id));

  const toggle = (id) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const trigger = selected.length ? (
    <AssigneeAvatars users={selected} max={4} />
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs text-gray-500 hover:border-gray-400">
      <UserPlus className="h-3.5 w-3.5" /> Assign
    </span>
  );

  return (
    <Dropdown trigger={trigger} buttonClassName="px-1 py-0.5">
      {users.length === 0 ? (
        <p className="px-3 py-2 text-xs text-gray-500">No staff found</p>
      ) : (
        users.map((u) => {
          const on = value.includes(u.id);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => toggle(u.id)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border ${
                  on ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300'
                }`}
              >
                {on && <Check className="h-3 w-3" />}
              </span>
              {u.name}
            </button>
          );
        })
      )}
    </Dropdown>
  );
}
