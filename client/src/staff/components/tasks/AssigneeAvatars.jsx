// Overlapping initial circles. Shows up to `max`, then "+N". Tooltip lists names.
const PALETTE = ['bg-violet-600', 'bg-brand-700', 'bg-blue-600', 'bg-teal-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600'];
export const avatarColour = (id) => PALETTE[(id ?? 0) % PALETTE.length];

export function Avatar({ user, size = 'h-7 w-7 text-xs', ring = true }) {
  return (
    <span
      title={user.name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold uppercase text-white ${size} ${avatarColour(
        user.id
      )} ${ring ? 'ring-2 ring-white' : ''}`}
    >
      {user.name?.[0] || '?'}
    </span>
  );
}

export default function AssigneeAvatars({ users = [], max = 3 }) {
  if (!users.length) return <span className="text-xs text-gray-400">Unassigned</span>;
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="flex items-center -space-x-2" title={users.map((u) => u.name).join(', ')}>
      {shown.map((u) => (
        <Avatar key={u.id} user={u} />
      ))}
      {extra > 0 && (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600 ring-2 ring-white">
          +{extra}
        </span>
      )}
    </span>
  );
}
