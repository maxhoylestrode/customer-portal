import { useNavigate } from 'react-router-dom';
import { CheckSquare } from 'lucide-react';
import StatusPill from './StatusPill';
import PriorityFlag from './PriorityFlag';
import AssigneeAvatars from './AssigneeAvatars';
import DueDate from './DueDate';
import ProgressBar from './ProgressBar';
import { typeOf, subtaskCounts } from '../../constants/tasks';

// One task in the list view (and, with `compact`, on a client's page).
//  - onStatusChange(task, status): shows the status dot as a dropdown
//  - compact: hide priority / progress / subtasks columns
export default function TaskRow({ task, onStatusChange, showClient = true, compact = false }) {
  const navigate = useNavigate();
  const go = () => navigate(`/staff/tasks/${task.id}`);
  const { done, total } = subtaskCounts(task);
  const isComplete = task.status === 'complete';

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => e.key === 'Enter' && go()}
      className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
    >
      <StatusPill compact status={task.status} onChange={onStatusChange ? (s) => onStatusChange(task, s) : undefined} />

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${isComplete ? 'text-gray-400 line-through' : 'text-brand-700'}`}>{task.name}</p>
        <p className="truncate text-xs text-gray-500">
          {showClient && task.client?.name}
          {showClient && task.client?.name && ' · '}
          {typeOf(task.taskType).label}
        </p>
      </div>

      <div className="hidden w-24 shrink-0 md:block">
        <AssigneeAvatars users={task.assignedUsers} />
      </div>

      <div className="w-28 shrink-0 text-right md:text-left">
        <DueDate date={task.endDate} complete={isComplete} />
      </div>

      {!compact && (
        <>
          <div className="hidden w-24 shrink-0 lg:block">
            <PriorityFlag priority={task.priority} />
          </div>
          <div className="hidden w-28 shrink-0 lg:block">
            <ProgressBar value={task.progress} showLabel />
          </div>
          <div className="hidden w-14 shrink-0 items-center gap-1 text-xs text-gray-500 lg:flex">
            {total > 0 && (
              <>
                <CheckSquare className="h-3.5 w-3.5" />
                {done}/{total}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Header row matching TaskRow's columns (desktop only)
export function TaskRowHeader({ compact = false }) {
  const cls = 'text-[11px] font-semibold uppercase tracking-wide text-gray-400';
  return (
    <div className="hidden items-center gap-3 border-b border-gray-100 px-4 py-1.5 md:flex">
      <span className="w-5 shrink-0" />
      <span className={`flex-1 ${cls}`}>Task</span>
      <span className={`w-24 shrink-0 ${cls}`}>Assignees</span>
      <span className={`w-28 shrink-0 ${cls}`}>Due</span>
      {!compact && (
        <>
          <span className={`hidden w-24 shrink-0 lg:block ${cls}`}>Priority</span>
          <span className={`hidden w-28 shrink-0 lg:block ${cls}`}>Progress</span>
          <span className={`hidden w-14 shrink-0 lg:block ${cls}`}>Sub</span>
        </>
      )}
    </div>
  );
}
