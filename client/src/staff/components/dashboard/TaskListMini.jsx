import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check } from 'lucide-react';
import api from '../../api';
import StatusPill from '../tasks/StatusPill';
import DueDate from '../tasks/DueDate';
import { apiError } from '../../constants/tasks';

// How long a ticked-off task stays (struck through) before the list refreshes
const LINGER_MS = 1200;

// Compact task rows: a tick box to finish the task, name and client, a status
// dropdown and the due date. `onChanged` refreshes the dashboard afterwards.
export default function TaskListMini({ tasks, onChanged }) {
  // id -> status shown while a change is in flight or lingering
  const [local, setLocal] = useState({});

  const setStatus = async (task, status, { undoable = false, progress } = {}) => {
    const before = local[task.id] ?? task.status;
    if (before === status) return;
    setLocal((m) => ({ ...m, [task.id]: status }));
    try {
      await api.put(`/projects/${task.id}`, progress === undefined ? { status } : { status, progress });
    } catch (err) {
      setLocal((m) => ({ ...m, [task.id]: before }));
      toast.error(apiError(err, 'Could not change the status'));
      return;
    }

    if (undoable) {
      toast(
        (t) => (
          <span className="flex items-center gap-3">
            <span>
              Done: <strong className="font-medium">{task.name}</strong>
            </span>
            <button
              className="font-medium text-brand-500 hover:underline"
              onClick={() => {
                toast.dismiss(t.id);
                // Completing sets progress to 100%, so put the old value back too
                setStatus({ ...task, status }, before, { progress: task.progress });
              }}
            >
              Undo
            </button>
          </span>
        ),
        { duration: 5000 }
      );
    }
    setTimeout(() => {
      onChanged?.();
      // Drop the local override once the fresh list has the real status
      setTimeout(() => setLocal((m) => {
        const { [task.id]: _, ...rest } = m;
        return rest;
      }), 500);
    }, status === 'complete' ? LINGER_MS : 0);
  };

  return (
    <ul className="-mx-2 divide-y divide-gray-50">
      {tasks.map((t) => {
        const status = local[t.id] ?? t.status;
        const done = status === 'complete';
        return (
          <li key={t.id} className={`group/row flex items-center gap-3 rounded-lg px-2 py-2 transition-opacity hover:bg-gray-50 ${done ? 'opacity-60' : ''}`}>
            <button
              type="button"
              role="checkbox"
              aria-checked={done}
              aria-label={done ? `Mark "${t.name}" as not done` : `Mark "${t.name}" as done`}
              title={done ? 'Mark as not done' : 'Mark as done'}
              onClick={() => (done ? setStatus(t, t.status, { progress: t.progress }) : setStatus(t, 'complete', { undoable: true }))}
              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                done
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-line-strong text-transparent hover:border-emerald-500 hover:text-emerald-500'
              }`}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </button>
            <Link to={`/staff/tasks/${t.id}`} className="min-w-0 flex-1">
              <p className={`truncate text-sm font-medium ${done ? 'text-gray-500 line-through' : 'text-gray-800 group-hover/row:text-gray-900'}`}>
                {t.name}
              </p>
              <p className="truncate text-xs text-gray-500">{t.clientName}</p>
            </Link>
            <div className="hidden shrink-0 sm:block">
              <StatusPill status={status} align="right" onChange={(s) => setStatus(t, s, { undoable: s === 'complete' })} />
            </div>
            <DueDate date={t.endDate} complete={done} className="w-24 text-right" />
          </li>
        );
      })}
    </ul>
  );
}
