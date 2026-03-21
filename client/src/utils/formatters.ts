export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    complete: 'Complete',
    out_of_scope: 'Out of Scope',
  };
  return labels[status] || status;
}

export function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    low: 'Low',
    normal: 'Normal',
    high: 'High',
  };
  return labels[priority] || priority;
}

export function getScopeLabel(scope: string): string {
  const labels: Record<string, string> = {
    in_scope: 'In Scope',
    out_of_scope: 'Out of Scope',
    unknown: 'Unknown',
  };
  return labels[scope] || scope;
}

export function getActivityLabel(action: string): string {
  const labels: Record<string, string> = {
    ticket_created: 'Ticket submitted',
    status_changed: 'Status updated',
    scope_updated: 'Scope updated',
    priority_changed: 'Priority changed',
    note_added: 'Notes updated',
    attachment_uploaded: 'File uploaded',
    attachment_deleted: 'File removed',
  };
  return labels[action] || action;
}
