// NOTE: "Project" in the database/API is shown to users as a "Task".
// Keep these in step with client/src/staff/constants/tasks.js.

export const TASK_STATUSES = ['to_do', 'in_progress', 'review', 'on_hold', 'complete'] as const;
export const TASK_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;
export const TASK_TYPES = ['website', 'maintenance', 'hosting', 'seo', 'design', 'other'] as const;

export type TaskStatus = typeof TASK_STATUSES[number];
export type TaskPriority = typeof TASK_PRIORITIES[number];
export type TaskType = typeof TASK_TYPES[number];

export const STATUS_LABELS: Record<string, string> = {
  to_do: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  on_hold: 'On Hold',
  complete: 'Complete',
};

export const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  complete: 'Complete',
  out_of_scope: 'Out of Scope',
};

// Due dates are stored as UTC midnight, so format in UTC to avoid showing the day before.
export function formatDateGB(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
