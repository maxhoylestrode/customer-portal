// NOTE: "Project" in the database/API is shown to users as a "Task".
// Single source of truth for task labels and colours. Keep in step with
// server/src/constants/tasks.ts.

export const STATUSES = [
  { value: 'to_do',       label: 'To Do',       dot: 'bg-gray-400',    pill: 'bg-gray-100 text-gray-700',       hex: '#9ca3af', border: '#6b7280' },
  { value: 'in_progress', label: 'In Progress', dot: 'bg-blue-500',    pill: 'bg-blue-100 text-blue-700',       hex: '#3b82f6', border: '#2563eb' },
  { value: 'review',      label: 'In Review',   dot: 'bg-violet-500',  pill: 'bg-violet-100 text-violet-700',   hex: '#8b5cf6', border: '#7c3aed' },
  { value: 'on_hold',     label: 'On Hold',     dot: 'bg-amber-500',   pill: 'bg-amber-100 text-amber-700',     hex: '#f59e0b', border: '#d97706' },
  { value: 'complete',    label: 'Complete',    dot: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-700', hex: '#10b981', border: '#059669' },
];

export const PRIORITIES = [
  { value: 'urgent', label: 'Urgent', text: 'text-red-600',    rank: 0 },
  { value: 'high',   label: 'High',   text: 'text-orange-500', rank: 1 },
  { value: 'normal', label: 'Normal', text: 'text-blue-500',   rank: 2 },
  { value: 'low',    label: 'Low',    text: 'text-gray-400',   rank: 3 },
];

export const TYPES = [
  { value: 'website',     label: 'Website' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'hosting',     label: 'Hosting' },
  { value: 'seo',         label: 'SEO' },
  { value: 'design',      label: 'Design' },
  { value: 'other',       label: 'Other' },
];

export const statusOf   = (v) => STATUSES.find((s) => s.value === v)   ?? STATUSES[0];
export const priorityOf = (v) => PRIORITIES.find((p) => p.value === v) ?? PRIORITIES[2];
export const typeOf     = (v) => TYPES.find((t) => t.value === v)      ?? TYPES[5];

// ── Date helpers ────────────────────────────────────────────────────────────
// Due dates come back from the API as UTC-midnight ISO strings, so compare
// and format the calendar day ("YYYY-MM-DD") rather than local times.

export const dayKey = (iso) => (iso ? String(iso).slice(0, 10) : '');

export function todayKey() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

// Whole days from today until the date (negative = in the past)
export function daysUntil(iso) {
  const k = dayKey(iso);
  if (!k) return null;
  return dayNumber(k) - dayNumber(todayKey());
}

// 'none' | 'overdue' | 'today' | 'soon' | 'ok'
export function dueState(iso, complete = false) {
  const n = daysUntil(iso);
  if (n === null) return 'none';
  if (complete) return 'ok';
  if (n < 0) return 'overdue';
  if (n === 0) return 'today';
  if (n <= 3) return 'soon';
  return 'ok';
}

export function formatDay(iso, withYear = false) {
  if (!iso) return '';
  return new Date(dayKey(iso)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

// Sort used inside list groups: priority first, then soonest due date, no date last
export function compareTasks(a, b) {
  const pr = priorityOf(a.priority).rank - priorityOf(b.priority).rank;
  if (pr !== 0) return pr;
  const ad = dayKey(a.endDate);
  const bd = dayKey(b.endDate);
  if (ad && bd) return ad < bd ? -1 : ad > bd ? 1 : 0;
  if (ad) return -1;
  if (bd) return 1;
  return 0;
}

export function subtaskCounts(task) {
  const list = Array.isArray(task.subtasks) ? task.subtasks : [];
  return { done: list.filter((s) => s.isDone).length, total: list.length };
}

export function apiError(err, fallback = 'Something went wrong') {
  return err?.response?.data?.error || fallback;
}
