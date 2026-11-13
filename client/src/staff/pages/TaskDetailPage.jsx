// NOTE: "Project" in the database/API is shown to users as a "Task".
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CalendarClock,
  CheckSquare,
  CircleDot,
  Flag,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  UserPlus,
  X,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import useStaffUsers from '../hooks/useStaffUsers';
import Dropdown from '../components/tasks/Dropdown';
import StatusPill from '../components/tasks/StatusPill';
import PriorityFlag from '../components/tasks/PriorityFlag';
import AssigneePicker from '../components/tasks/AssigneePicker';
import ProgressBar from '../components/tasks/ProgressBar';
import TaskFormModal from '../components/tasks/TaskFormModal';
import { Avatar } from '../components/tasks/AssigneeAvatars';
import { TYPES, dayKey, formatDay, subtaskCounts, apiError } from '../constants/tasks';
import { timeAgo } from '../../utils/formatters';

const FEED_ICONS = {
  created: Sparkles,
  status_changed: CircleDot,
  priority_changed: Flag,
  assignees_changed: UserPlus,
  due_date_changed: CalendarClock,
  progress_changed: TrendingUp,
  subtask_added: CheckSquare,
  subtask_completed: CheckSquare,
};

const fieldCls =
  'rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:border-brand-700 focus:outline-none';

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const blocked = user?.role === 'sales';
  const staff = useStaffUsers();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);

  // inline editing state
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const skipNameBlur = useRef(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [progress, setProgress] = useState(0);
  const [newSubtask, setNewSubtask] = useState('');
  const [editingSub, setEditingSub] = useState(null); // { id, value }
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await api.get(`/projects/${id}`);
        setTask(res.data);
        setProgress(res.data.progress);
      } catch (err) {
        if (silent) return;
        toast.error(err.response?.status === 404 ? 'Task not found' : apiError(err, 'Could not load the task'));
        navigate('/staff/tasks');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id, navigate]
  );

  useEffect(() => {
    if (!blocked) load();
  }, [blocked, load]);

  if (blocked) return <Navigate to="/staff" replace />;

  if (loading || !task) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  // Save one or more fields. PUT returns the full task, so the page (and the
  // updates feed with its new system entry) refreshes from the response.
  const save = async (patch) => {
    try {
      const res = await api.put(`/projects/${task.id}`, patch);
      setTask(res.data);
      setProgress(res.data.progress);
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Could not save that change'));
      setProgress(task.progress);
      return false;
    }
  };

  const commitName = async () => {
    if (skipNameBlur.current) {
      skipNameBlur.current = false;
      return;
    }
    const name = nameDraft.trim();
    setEditingName(false);
    if (name && name !== task.name) await save({ name });
  };

  const commitDescription = async () => {
    if (await save({ description: descDraft })) setEditingDesc(false);
  };

  const commitProgress = async () => {
    if (progress !== task.progress) await save({ progress });
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task and everything on it? This cannot be undone.')) return;
    try {
      await api.delete(`/projects/${task.id}`);
      toast.success('Task deleted');
      navigate('/staff/tasks');
    } catch (err) {
      toast.error(apiError(err, 'Delete failed'));
    }
  };

  // ── Subtasks ──
  const addSubtask = async (e) => {
    e.preventDefault();
    const title = newSubtask.trim();
    if (!title) return;
    try {
      const res = await api.post(`/projects/${task.id}/subtasks`, { title });
      setTask((t) => ({ ...t, subtasks: [...t.subtasks, res.data] }));
      setNewSubtask('');
      load(true); // pick up the new feed entry
    } catch (err) {
      toast.error(apiError(err, 'Could not add the subtask'));
    }
  };

  const patchSubtask = async (sub, patch, refreshFeed = false) => {
    const before = task.subtasks;
    // optimistic for the checkbox; other fields wait for the server
    if ('isDone' in patch) {
      setTask((t) => ({ ...t, subtasks: t.subtasks.map((s) => (s.id === sub.id ? { ...s, ...patch } : s)) }));
    }
    try {
      const res = await api.put(`/projects/${task.id}/subtasks/${sub.id}`, patch);
      setTask((t) => ({ ...t, subtasks: t.subtasks.map((s) => (s.id === sub.id ? res.data : s)) }));
      if (refreshFeed) load(true);
    } catch (err) {
      setTask((t) => ({ ...t, subtasks: before }));
      toast.error(apiError(err, 'Could not update the subtask'));
    }
  };

  const deleteSubtask = async (sub) => {
    try {
      await api.delete(`/projects/${task.id}/subtasks/${sub.id}`);
      setTask((t) => ({ ...t, subtasks: t.subtasks.filter((s) => s.id !== sub.id) }));
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the subtask'));
    }
  };

  const commitSubtaskTitle = async (sub) => {
    const value = editingSub?.value.trim();
    setEditingSub(null);
    if (value && value !== sub.title) await patchSubtask(sub, { title: value });
  };

  // ── Updates feed ──
  const postComment = async () => {
    const body = comment.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const res = await api.post(`/projects/${task.id}/updates`, { body });
      setTask((t) => ({ ...t, updates: [res.data, ...t.updates] }));
      setComment('');
    } catch (err) {
      toast.error(apiError(err, 'Could not post the update'));
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (update) => {
    try {
      await api.delete(`/projects/${task.id}/updates/${update.id}`);
      setTask((t) => ({ ...t, updates: t.updates.filter((u) => u.id !== update.id) }));
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the update'));
    }
  };

  const { done, total } = subtaskCounts(task);
  const subPct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div>
        <nav className="mb-2 flex items-center gap-1 text-xs text-gray-500">
          <Link to="/staff/tasks" className="hover:text-[#0D3040]">
            Tasks
          </Link>
          <span>›</span>
          <Link to={`/staff/clients/${task.clientId}`} className="hover:text-[#0D3040]">
            {task.client?.name}
          </Link>
        </nav>
        <div className="flex items-start justify-between gap-4">
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  skipNameBlur.current = true;
                  setEditingName(false);
                }
              }}
              className="w-full rounded-lg border border-brand-600 px-2 py-1 text-2xl font-bold text-[#0D3040] focus:outline-none"
            />
          ) : (
            <h1
              title="Click to rename"
              onClick={() => {
                skipNameBlur.current = false;
                setNameDraft(task.name);
                setEditingName(true);
              }}
              className="cursor-text rounded-lg px-2 py-1 text-2xl font-bold text-[#0D3040] hover:bg-gray-100"
            >
              {task.name}
            </h1>
          )}
          <Dropdown align="right" trigger={<MoreHorizontal className="h-5 w-5 text-gray-500" />} buttonClassName="p-1.5 hover:bg-gray-100">
            {(close) => (
              <>
                <button
                  onClick={() => {
                    close();
                    setEditModal(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="h-4 w-4" /> Edit details
                </button>
                <button
                  onClick={() => {
                    close();
                    handleDelete();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" /> Delete task
                </button>
              </>
            )}
          </Dropdown>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-5 lg:col-span-2">
          {/* Properties */}
          <Card>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <Prop label="Status">
                <StatusPill status={task.status} onChange={(status) => save({ status })} />
              </Prop>
              <Prop label="Priority">
                <PriorityFlag priority={task.priority} onChange={(priority) => save({ priority })} />
              </Prop>
              <Prop label="Assignees">
                <AssigneePicker
                  value={task.assignedUsers.map((u) => u.id)}
                  onChange={(ids) => save({ assignedUserIds: ids })}
                />
              </Prop>
              <Prop label="Type">
                <select className={fieldCls} value={task.taskType} onChange={(e) => save({ taskType: e.target.value })}>
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Prop>
              <Prop label="Start date">
                <DateField className={fieldCls} value={dayKey(task.startDate)} onCommit={(v) => save({ startDate: v })} />
              </Prop>
              <Prop label="Due date">
                <DateField className={fieldCls} value={dayKey(task.endDate)} onCommit={(v) => save({ endDate: v })} />
              </Prop>
              <Prop label="Created">
                <span className="text-sm text-gray-600">
                  by {task.createdBy?.name || 'Unknown'} on {formatDay(task.createdAt, true)}
                </span>
              </Prop>
            </dl>
          </Card>

          {/* Progress */}
          <Card>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-[#0D3040]">Progress</h2>
              <span className="text-2xl font-bold text-[#0D3040]">{progress}%</span>
            </div>
            <ProgressBar value={progress} />
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              onMouseUp={commitProgress}
              onTouchEnd={commitProgress}
              onKeyUp={commitProgress}
              aria-label="Progress"
              className="mt-3 w-full accent-brand-600"
            />
            {total > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {done} of {total} subtasks done
              </p>
            )}
          </Card>

          {/* Description */}
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0D3040]">Description</h2>
              {!editingDesc && (
                <button
                  onClick={() => {
                    setDescDraft(task.description || '');
                    setEditingDesc(true);
                  }}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
            {editingDesc ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  rows={6}
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingDesc(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800">
                    Cancel
                  </button>
                  <button onClick={commitDescription} className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600">
                    Save
                  </button>
                </div>
              </div>
            ) : task.description ? (
              <p className="whitespace-pre-wrap text-sm text-gray-700">{task.description}</p>
            ) : (
              <p className="text-sm text-gray-400">Add a description: scope, links, logins needed…</p>
            )}
          </Card>

          {/* Subtasks */}
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-sm font-semibold text-[#0D3040]">Subtasks</h2>
              {total > 0 && (
                <>
                  <span className="text-xs text-gray-500">
                    {done}/{total}
                  </span>
                  <div className="w-24">
                    <ProgressBar value={subPct} />
                  </div>
                </>
              )}
            </div>
            <ul className="divide-y divide-gray-50">
              {task.subtasks.map((s) => (
                <li key={s.id} className="group flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={s.isDone}
                    onChange={(e) => patchSubtask(s, { isDone: e.target.checked }, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 accent-brand-600"
                  />
                  {editingSub?.id === s.id ? (
                    <input
                      autoFocus
                      value={editingSub.value}
                      onChange={(e) => setEditingSub({ id: s.id, value: e.target.value })}
                      onBlur={() => commitSubtaskTitle(s)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') setEditingSub(null);
                      }}
                      className="flex-1 rounded border border-brand-600 px-2 py-0.5 text-sm focus:outline-none"
                    />
                  ) : (
                    <span
                      onClick={() => setEditingSub({ id: s.id, value: s.title })}
                      className={`flex-1 cursor-text text-sm ${s.isDone ? 'text-gray-400 line-through' : 'text-gray-800'}`}
                    >
                      {s.title}
                    </span>
                  )}
                  <Dropdown
                    align="right"
                    title="Assign"
                    buttonClassName="p-0.5"
                    trigger={
                      s.assignee ? (
                        <Avatar user={s.assignee} size="h-6 w-6 text-[10px]" ring={false} />
                      ) : (
                        <UserPlus className="h-4 w-4 text-gray-300 hover:text-gray-500" />
                      )
                    }
                  >
                    {(close) => (
                      <>
                        <button
                          onClick={() => {
                            close();
                            patchSubtask(s, { assigneeId: null });
                          }}
                          className="block w-full px-3 py-1.5 text-left text-sm text-gray-500 hover:bg-gray-50"
                        >
                          Unassigned
                        </button>
                        {staff.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              close();
                              patchSubtask(s, { assigneeId: u.id });
                            }}
                            className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${
                              s.assignee?.id === u.id ? 'font-semibold text-brand-700' : 'text-gray-700'
                            }`}
                          >
                            {u.name}
                          </button>
                        ))}
                      </>
                    )}
                  </Dropdown>
                  <DateField
                    value={dayKey(s.dueDate)}
                    onCommit={(v) => patchSubtask(s, { dueDate: v })}
                    aria-label="Subtask due date"
                    className="w-28 rounded border border-transparent bg-transparent px-1 text-xs text-gray-500 hover:border-gray-300 focus:border-brand-700 focus:outline-none"
                  />
                  <button
                    onClick={() => deleteSubtask(s)}
                    aria-label="Delete subtask"
                    className="text-gray-300 opacity-0 transition hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={addSubtask} className="mt-2 flex items-center gap-2">
              <Plus className="h-4 w-4 text-gray-400" />
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Add a subtask and press Enter"
                className="flex-1 rounded-lg border border-transparent px-2 py-1.5 text-sm placeholder-gray-400 hover:border-gray-200 focus:border-brand-700 focus:outline-none"
              />
            </form>
          </Card>

          {/* Milestones (read-only; edited from "Edit details") */}
          {task.milestones.length > 0 && (
            <Card>
              <h2 className="mb-2 text-sm font-semibold text-[#0D3040]">Milestones</h2>
              <ul className="space-y-1.5">
                {task.milestones.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-amber-600">⬥</span>
                    <span className="w-24 shrink-0 text-gray-500">{formatDay(m.date, true)}</span>
                    {m.title}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Right column: updates */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-[#0D3040]">Updates</h2>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  postComment();
                }
              }}
              placeholder="Post an update…"
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-brand-700 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">Ctrl/Cmd + Enter to post</span>
              <button
                onClick={postComment}
                disabled={!comment.trim() || posting}
                className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>

            <ul className="mt-4 space-y-3">
              {task.updates.map((u) =>
                u.type === 'comment' ? (
                  <li key={u.id} className="group flex gap-2.5">
                    <Avatar user={u.user || { id: 0, name: '?' }} ring={false} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-gray-800">{u.user?.name || 'Former staff member'}</span>
                        <span className="text-xs text-gray-400" title={new Date(u.createdAt).toLocaleString('en-GB')}>
                          {timeAgo(u.createdAt)}
                        </span>
                        {(u.userId === user.id || user.role === 'admin') && (
                          <button
                            onClick={() => deleteComment(u)}
                            aria-label="Delete update"
                            className="ml-auto text-gray-300 opacity-0 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{u.body}</p>
                    </div>
                  </li>
                ) : (
                  <FeedLine key={u.id} update={u} />
                )
              )}
              {task.updates.length === 0 && <li className="text-sm text-gray-400">No updates yet.</li>}
            </ul>
          </Card>
        </div>
      </div>

      <TaskFormModal
        open={editModal}
        task={task}
        onClose={() => setEditModal(false)}
        onSaved={(saved) => {
          setEditModal(false);
          setTask(saved);
          setProgress(saved.progress);
        }}
      />
    </div>
  );
}

// Date input that keeps what you're typing locally and only saves a complete,
// plausible date. (Browsers fire change for partial years like "0002" while
// you type, which would otherwise save and log every keystroke.)
function DateField({ value, onCommit, className = '', ...rest }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const handle = (e) => {
    const v = e.target.value;
    setDraft(v);
    if (v === '') {
      if (value) onCommit(null);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 2000 && v !== value) {
      onCommit(v);
    }
  };

  return <input type="date" value={draft} onChange={handle} className={className} {...rest} />;
}

function FeedLine({ update }) {
  const Icon = FEED_ICONS[update.type] || CircleDot;
  return (
    <li className="flex items-start gap-2 text-xs text-gray-500">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
      <span>
        <span className="font-medium text-gray-600">{update.user?.name || 'Someone'}</span> {update.body} ·{' '}
        <span title={new Date(update.createdAt).toLocaleString('en-GB')}>{timeAgo(update.createdAt)}</span>
      </span>
    </li>
  );
}

function Card({ children }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-5">{children}</div>;
}

function Prop({ label, children }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
