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

// "just now", "5m ago", "3h ago", "yesterday", otherwise "14 Nov"
export function timeAgo(dateString: string): string {
  const then = new Date(dateString);
  const secs = Math.floor((Date.now() - then.getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  if (Math.floor(hrs / 24) === 1) return 'yesterday';
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
