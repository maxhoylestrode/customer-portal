import { useNavigate } from 'react-router-dom';
import { CheckSquare } from 'lucide-react';
import PriorityFlag from './PriorityFlag';
import AssigneeAvatars from './AssigneeAvatars';
import DueDate from './DueDate';
import ProgressBar from './ProgressBar';
import { subtaskCounts } from '../../constants/tasks';

// One card in the board view. Drag it onto another column to change status.
export default function TaskCard({ task, onDragStart, onDragEnd, dragging }) {
  const navigate = useNavigate();
  const { done, total } = subtaskCounts(task);
  const isComplete = task.status === 'complete';

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(task.id));
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(task);
      }}
      onDragEnd={onDragEnd}
      onClick={() => navigate(`/staff/tasks/${task.id}`)}
      className={`cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow ${
        dragging ? 'opacity-40' : ''
      }`}
    >
      <p className={`text-sm font-medium ${isComplete ? 'text-gray-400 line-through' : 'text-brand-700'}`}>{task.name}</p>
      {task.client?.name && <p className="mt-0.5 truncate text-xs text-gray-500">{task.client.name}</p>}

      <div className="mt-2 flex items-center justify-between">
        <PriorityFlag priority={task.priority} />
        <DueDate date={task.endDate} complete={isComplete} />
      </div>

      {task.progress > 0 && <ProgressBar value={task.progress} className="mt-2" />}

      <div className="mt-2 flex items-center justify-between">
        <AssigneeAvatars users={task.assignedUsers} />
        {total > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <CheckSquare className="h-3.5 w-3.5" />
            {done}/{total}
          </span>
        )}
      </div>
    </div>
  );
}
