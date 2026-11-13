import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';
import Modal from '../Modal';
import AssigneePicker from './AssigneePicker';
import { STATUSES, PRIORITIES, TYPES, dayKey, apiError } from '../../constants/tasks';

// NOTE: "Project" in the database/API is shown to users as a "Task".

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700';

const EMPTY = {
  name: '',
  clientId: '',
  taskType: 'other',
  priority: 'normal',
  status: 'to_do',
  assignedUserIds: [],
  startDate: '',
  endDate: '',
  description: '',
  milestones: [],
};

// Create or edit a task.
//  - task: existing task to edit (omit to create)
//  - clientId: preset client (hides the client picker)
//  - defaultStatus: starting status for a new task
//  - onSaved(task): called with the saved task
export default function TaskFormModal({ open, task, clientId, defaultStatus, onClose, onSaved }) {
  const isEdit = !!task;
  const [form, setForm] = useState(EMPTY);
  const [clients, setClients] = useState([]);
  const [saving, setSaving] = useState(false);

  // Reset the form each time the modal opens
  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        name: task.name || '',
        clientId: task.clientId || '',
        taskType: task.taskType || 'other',
        priority: task.priority || 'normal',
        status: task.status || 'to_do',
        assignedUserIds: (task.assignedUsers || []).map((u) => u.id),
        startDate: dayKey(task.startDate),
        endDate: dayKey(task.endDate),
        description: task.description || '',
        milestones: (task.milestones || []).map((m) => ({ title: m.title, date: dayKey(m.date) })),
      });
    } else {
      setForm({ ...EMPTY, clientId: clientId || '', status: defaultStatus || 'to_do' });
    }
  }, [open, task, clientId, defaultStatus]);

  // Client list is only needed when creating without a preset client
  useEffect(() => {
    if (open && !isEdit && !clientId && clients.length === 0) {
      api
        .get('/clients')
        .then((r) => setClients(Array.isArray(r.data) ? r.data : []))
        .catch(() => {});
    }
  }, [open, isEdit, clientId, clients.length]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const setMilestone = (i, field, value) =>
    setForm((f) => ({ ...f, milestones: f.milestones.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !form.clientId) {
      toast.error('Choose a client');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        taskType: form.taskType,
        priority: form.priority,
        status: form.status,
        assignedUserIds: form.assignedUserIds,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        description: form.description,
        milestones: form.milestones.filter((m) => m.title.trim() && m.date),
      };
      const res = isEdit
        ? await api.put(`/projects/${task.id}`, payload)
        : await api.post('/projects', { ...payload, clientId: Number(form.clientId) });
      toast.success(isEdit ? 'Task updated' : 'Task created');
      onSaved?.(res.data);
    } catch (err) {
      toast.error(apiError(err, 'Could not save the task'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Task' : 'New Task'} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Task name *">
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Website rebuild"
            required
            autoFocus
          />
        </Field>

        {!isEdit && !clientId && (
          <Field label="Client *">
            <select className={inputCls} value={form.clientId} onChange={(e) => set('clientId', e.target.value)} required>
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? ` (${c.company})` : ''}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type">
            <select className={inputCls} value={form.taskType} onChange={(e) => set('taskType', e.target.value)}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <div className="flex gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => set('priority', p.value)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition ${
                    form.priority === p.value
                      ? `border-brand-600 bg-brand-50 ${p.text}`
                      : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Status">
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => set('status', s.value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  form.status === s.value
                    ? `border-transparent ${s.pill} ring-2 ring-brand-300`
                    : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                {s.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Assignees">
          <AssigneePicker value={form.assignedUserIds} onChange={(ids) => set('assignedUserIds', ids)} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Start date">
            <input type="date" className={inputCls} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
          <Field label="Due date">
            <input type="date" className={inputCls} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            rows={5}
            className={inputCls}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Scope, links, logins needed…"
          />
        </Field>

        {/* Milestones */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Milestones</label>
            <button
              type="button"
              onClick={() => set('milestones', [...form.milestones, { title: '', date: '' }])}
              className="text-xs text-brand-600 hover:underline"
            >
              + Add milestone
            </button>
          </div>
          {form.milestones.map((m, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <input
                placeholder="Title"
                value={m.title}
                onChange={(e) => setMilestone(i, 'title', e.target.value)}
                className={`flex-1 ${inputCls}`}
              />
              <input type="date" value={m.date} onChange={(e) => setMilestone(i, 'date', e.target.value)} className={inputCls + ' !w-auto'} />
              <button
                type="button"
                onClick={() => set('milestones', form.milestones.filter((_, idx) => idx !== i))}
                className="px-1 text-red-700 hover:text-red-600"
                aria-label="Remove milestone"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-800">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
