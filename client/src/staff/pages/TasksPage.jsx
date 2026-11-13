// NOTE: "Project" in the database/API is shown to users as a "Task".
import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronRight, LayoutGrid, List, ListChecks, Plus, Search, X } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import useStaffUsers from '../hooks/useStaffUsers';
import TaskRow, { TaskRowHeader } from '../components/tasks/TaskRow';
import TaskCard from '../components/tasks/TaskCard';
import TaskFormModal from '../components/tasks/TaskFormModal';
import { STATUSES, PRIORITIES, TYPES, compareTasks, apiError } from '../constants/tasks';

const selectCls =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 focus:border-brand-700 focus:outline-none';

function readView() {
  try {
    return localStorage.getItem('tasks.view') === 'board' ? 'board' : 'list';
  } catch {
    return 'list';
  }
}

export default function TasksPage() {
  const { user } = useAuth();
  const blocked = user?.role === 'sales';
  const [searchParams, setSearchParams] = useSearchParams();
  const get = (k) => searchParams.get(k) || '';

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState(readView);
  const [search, setSearch] = useState(get('q'));
  const [clients, setClients] = useState([]);
  const [collapsed, setCollapsed] = useState({});
  const [form, setForm] = useState({ open: false, status: 'to_do' });
  const [dragId, setDragId] = useState(null);
  const [overStatus, setOverStatus] = useState(null);
  const requestId = useRef(0);
  const staff = useStaffUsers();

  const mine = get('mine') === '1';
  const showCompleted = get('includeComplete') === '1';
  const overdue = get('overdue') === '1';
  const dueToday = get('dueToday') === '1';

  const setParam = (key, value) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );

  const setViewAndRemember = (v) => {
    setView(v);
    try {
      localStorage.setItem('tasks.view', v);
    } catch {
      /* private mode etc. - the choice just won't persist */
    }
  };

  // Debounce the search box into the URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== get('q')) setParam('q', search.trim());
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (blocked) return;
    api
      .get('/clients')
      .then((r) => setClients(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, [blocked]);

  // Fetch whenever the filters (the URL) change
  const paramsKey = searchParams.toString();
  useEffect(() => {
    if (blocked) return;
    const params = {};
    ['q', 'clientId', 'assignedUserId', 'priority', 'taskType'].forEach((k) => {
      const v = searchParams.get(k);
      if (v) params[k] = v;
    });
    if (mine) params.mine = '1';
    if (overdue) params.overdue = '1';
    if (dueToday) params.dueToday = '1';
    if (!showCompleted) params.includeComplete = '0';

    const myRequest = ++requestId.current;
    setLoading(true);
    api
      .get('/projects', { params })
      .then((r) => {
        if (myRequest === requestId.current) setTasks(Array.isArray(r.data) ? r.data : []);
      })
      .catch((err) => toast.error(apiError(err, 'Could not load tasks')))
      .finally(() => {
        if (myRequest === requestId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, reloadKey, blocked]);

  if (blocked) return <Navigate to="/staff" replace />;

  // Change a task's status straight from the list or board (optimistic)
  const changeStatus = async (task, status) => {
    if (task.status === status) return;
    const before = task;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status, progress: status === 'complete' ? 100 : t.progress } : t
      )
    );
    try {
      const res = await api.put(`/projects/${task.id}`, { status });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...res.data } : t)));
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? before : t)));
      toast.error(apiError(err, 'Could not change the status'));
    }
  };

  const anyFilter =
    get('q') || get('clientId') || get('assignedUserId') || get('priority') || get('taskType') || mine || overdue || dueToday || showCompleted;

  const clearFilters = () => {
    setSearch('');
    setSearchParams({}, { replace: true });
  };

  const openForm = (status = 'to_do') => setForm({ open: true, status });
  const sortedByStatus = (status) => tasks.filter((t) => t.status === status).sort(compareTasks);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0D3040]">Tasks</h1>
          <p className="mt-0.5 text-sm text-gray-500">Everything the team is working on</p>
        </div>
        <button
          onClick={() => openForm()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" /> New Task
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-44 rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-3 text-xs focus:border-brand-700 focus:outline-none sm:w-52"
          />
        </div>

        <Chip active={mine} onClick={() => setParam('mine', mine ? '' : '1')}>
          My tasks
        </Chip>

        <select className={selectCls} value={get('clientId')} onChange={(e) => setParam('clientId', e.target.value)}>
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className={selectCls} value={get('assignedUserId')} onChange={(e) => setParam('assignedUserId', e.target.value)}>
          <option value="">Anyone</option>
          {staff.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select className={selectCls} value={get('priority')} onChange={(e) => setParam('priority', e.target.value)}>
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select className={selectCls} value={get('taskType')} onChange={(e) => setParam('taskType', e.target.value)}>
          <option value="">Any type</option>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {overdue && (
          <Chip active onClick={() => setParam('overdue', '')}>
            Overdue <X className="ml-1 inline h-3 w-3" />
          </Chip>
        )}
        {dueToday && (
          <Chip active onClick={() => setParam('dueToday', '')}>
            Due today <X className="ml-1 inline h-3 w-3" />
          </Chip>
        )}

        <Chip active={showCompleted} onClick={() => setParam('includeComplete', showCompleted ? '' : '1')}>
          Show completed
        </Chip>

        {anyFilter && (
          <button onClick={clearFilters} className="px-2 text-xs text-gray-500 hover:text-gray-800">
            Clear
          </button>
        )}

        {/* View switch */}
        <div className="ml-auto flex overflow-hidden rounded-lg border border-gray-300 bg-white">
          <button
            onClick={() => setViewAndRemember('list')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium ${
              view === 'list' ? 'bg-brand-700 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
          <button
            onClick={() => setViewAndRemember('board')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium ${
              view === 'board' ? 'bg-brand-700 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Board
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && tasks.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-200/70" />
          ))}
        </div>
      ) : tasks.length === 0 && view === 'list' ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <ListChecks className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="text-gray-500">{anyFilter ? 'No tasks match those filters' : 'No tasks here yet'}</p>
          <button
            onClick={() => openForm()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" /> New Task
          </button>
        </div>
      ) : view === 'list' ? (
        <div className="space-y-4">
          {STATUSES.map((s) => {
            const group = sortedByStatus(s.value);
            if (group.length === 0) return null;
            if (s.value === 'complete' && !showCompleted) return null;
            const isCollapsed = collapsed[s.value];
            return (
              <div key={s.value} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [s.value]: !c[s.value] }))}
                  className="flex w-full items-center gap-2 border-b border-gray-100 px-4 py-2.5 text-left"
                >
                  {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                  <span className="text-sm font-semibold text-[#0D3040]">{s.label}</span>
                  <span className="text-xs text-gray-400">{group.length}</span>
                </button>
                {!isCollapsed && (
                  <>
                    <TaskRowHeader />
                    <div className="divide-y divide-gray-50">
                      {group.map((t) => (
                        <TaskRow key={t.id} task={t} onStatusChange={changeStatus} />
                      ))}
                    </div>
                    <button
                      onClick={() => openForm(s.value)}
                      className="flex w-full items-center gap-1.5 border-t border-gray-100 px-4 py-2 text-left text-xs text-gray-500 hover:bg-gray-50 hover:text-brand-600"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add task
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUSES.map((s) => {
            const col = sortedByStatus(s.value);
            return (
              <div
                key={s.value}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStatus(s.value);
                }}
                onDragLeave={() => setOverStatus((cur) => (cur === s.value ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = Number(e.dataTransfer.getData('text/plain')) || dragId;
                  const task = tasks.find((t) => t.id === id);
                  setOverStatus(null);
                  setDragId(null);
                  if (task) changeStatus(task, s.value);
                }}
                className={`w-72 shrink-0 rounded-xl bg-gray-100/70 p-2.5 transition ${
                  overStatus === s.value ? 'ring-2 ring-brand-300' : ''
                }`}
              >
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                  <span className="text-sm font-semibold text-[#0D3040]">{s.label}</span>
                  <span className="text-xs text-gray-400">{col.length}</span>
                </div>
                <div className="min-h-[3rem] space-y-2">
                  {col.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      dragging={dragId === t.id}
                      onDragStart={(task) => setDragId(task.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStatus(null);
                      }}
                    />
                  ))}
                  {col.length === 0 && (
                    <p className="px-1 py-3 text-center text-xs text-gray-400">
                      {s.value === 'complete' && !showCompleted ? 'Drop here to complete' : 'Nothing here'}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => openForm(s.value)}
                  className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-white hover:text-brand-600"
                >
                  <Plus className="h-3.5 w-3.5" /> Add task
                </button>
              </div>
            );
          })}
        </div>
      )}

      <TaskFormModal
        open={form.open}
        defaultStatus={form.status}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={() => {
          setForm((f) => ({ ...f, open: false }));
          setReloadKey((k) => k + 1);
        }}
      />
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'border-brand-600 bg-brand-100 text-brand-600'
          : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
      }`}
    >
      {children}
    </button>
  );
}
