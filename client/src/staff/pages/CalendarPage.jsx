import { useEffect, useState, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import api from '../api';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

// Deterministic colour palette for clients / users
const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];
const colorFromId = (id) => PALETTE[(id ?? 0) % PALETTE.length];

const STATUS_COLORS = {
  active:    { bg: '#10b981', border: '#059669' },
  complete:  { bg: '#3b82f6', border: '#2563eb' },
  'on-hold': { bg: '#f59e0b', border: '#d97706' },
  default:   { bg: '#6b7280', border: '#4b5563' },
};

export default function CalendarPage() {
  const { user: currentUser } = useAuth();
  const [projects, setProjects]         = useState([]);
  const [clients, setClients]           = useState([]);
  const [users, setUsers]               = useState([]);
  const [filterClient, setFilterClient] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUser, setFilterUser]     = useState('');
  const [colorMode, setColorMode]       = useState('status'); // 'status' | 'client' | 'user'
  const [showLegend, setShowLegend]     = useState(true);
  const [selected, setSelected]         = useState(null);
  const calRef = useRef(null);

  useEffect(() => {
    api.get('/clients').then((r) => setClients(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get('/users').then((r) => setUsers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    const params = {};
    if (filterClient) params.clientId = filterClient;
    if (filterStatus) params.status   = filterStatus;
    if (filterUser)   params.assignedUserId = filterUser;
    api.get('/projects', { params })
      .then((r) => setProjects(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, [filterClient, filterStatus, filterUser]);

  const setMyProjects = useCallback(() => {
    if (!currentUser) return;
    setFilterUser(String(currentUser.id));
    setFilterClient('');
    setFilterStatus('');
  }, [currentUser]);

  const clearFilters = () => {
    setFilterClient('');
    setFilterStatus('');
    setFilterUser('');
  };

  // Build FullCalendar events
  const events = [];
  projects.forEach((p) => {
    let bg, border;
    if (colorMode === 'client') {
      const c = colorFromId(p.clientId);
      bg = c; border = c;
    } else if (colorMode === 'user') {
      const uid = p.assignedUsers?.[0]?.id ?? p.id;
      const c = colorFromId(uid);
      bg = c; border = c;
    } else {
      const sc = STATUS_COLORS[p.status] ?? STATUS_COLORS.default;
      bg = sc.bg; border = sc.border;
    }

    events.push({
      id: `project-${p.id}`,
      title: p.name,
      start: p.startDate,
      end: p.endDate || p.startDate,
      allDay: true,
      backgroundColor: bg,
      borderColor: border,
      textColor: '#ffffff',
      extendedProps: { type: 'project', project: p },
    });

    (p.milestones || []).forEach((m) => {
      events.push({
        id: `milestone-${m.id}`,
        title: `⬥ ${m.title}`,
        start: m.date,
        allDay: true,
        backgroundColor: '#f59e0b',
        borderColor: '#d97706',
        textColor: '#ffffff',
        display: 'block',
        extendedProps: { type: 'milestone', milestone: m, project: p },
      });
    });
  });

  // Legend items
  const legendItems = (() => {
    if (colorMode === 'status') {
      return [
        { label: 'Active',    color: STATUS_COLORS.active.bg },
        { label: 'Complete',  color: STATUS_COLORS.complete.bg },
        { label: 'On Hold',   color: STATUS_COLORS['on-hold'].bg },
        { label: 'Milestone', color: '#f59e0b' },
      ];
    }
    if (colorMode === 'client') {
      return clients
        .filter((c) => projects.some((p) => p.clientId === c.id))
        .map((c) => ({ label: c.name, color: colorFromId(c.id) }));
    }
    // user mode
    const seen = new Set();
    const items = [];
    projects.forEach((p) => {
      (p.assignedUsers || []).forEach((u) => {
        if (!seen.has(u.id)) {
          seen.add(u.id);
          items.push({ label: u.name, color: colorFromId(u.id) });
        }
      });
    });
    return items;
  })();

  const hasFilters = filterClient || filterStatus || filterUser;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex flex-wrap items-center gap-2">
          {currentUser && (
            <button
              onClick={filterUser === String(currentUser.id) ? clearFilters : setMyProjects}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                filterUser === String(currentUser.id)
                  ? 'border-brand-500 bg-brand-600/20 text-brand-300'
                  : 'border-gray-700 bg-surface-light text-gray-400 hover:text-gray-200'
              }`}
            >
              {filterUser === String(currentUser.id) ? '✓ My Projects' : 'My Projects'}
            </button>
          )}
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="rounded-lg border border-gray-700 bg-surface-light px-3 py-2 text-xs text-gray-100 focus:border-brand-500 focus:outline-none"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-700 bg-surface-light px-3 py-2 text-xs text-gray-100 focus:border-brand-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="complete">Complete</option>
          </select>
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="rounded-lg border border-gray-700 bg-surface-light px-3 py-2 text-xs text-gray-100 focus:border-brand-500 focus:outline-none"
          >
            <option value="">All Staff</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select
            value={colorMode}
            onChange={(e) => setColorMode(e.target.value)}
            className="rounded-lg border border-gray-700 bg-surface-light px-3 py-2 text-xs text-gray-100 focus:border-brand-500 focus:outline-none"
          >
            <option value="status">Colour: Status</option>
            <option value="client">Colour: Client</option>
            <option value="user">Colour: Staff</option>
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-400 hover:text-gray-200"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Colour legend */}
      {showLegend && legendItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-gray-800 bg-surface px-4 py-2.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-gray-500">Legend</span>
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-gray-300">{item.label}</span>
            </div>
          ))}
          <button onClick={() => setShowLegend(false)} className="ml-auto text-xs text-gray-600 hover:text-gray-400">
            Hide
          </button>
        </div>
      )}
      {!showLegend && (
        <button onClick={() => setShowLegend(true)} className="text-xs text-gray-500 hover:text-gray-300">
          Show legend
        </button>
      )}

      {/* Calendar */}
      <div className="rounded-xl border border-gray-800 bg-surface p-4">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek',
          }}
          events={events}
          eventClick={(info) => {
            const ep = info.event.extendedProps;
            setSelected(ep.project ?? null);
          }}
          height="auto"
          eventDisplay="block"
          dayMaxEvents={4}
        />
      </div>

      {/* Project detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Project Details">
        {selected && (
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-500">Project:</span>{' '}
              <span className="font-medium text-gray-100">{selected.name}</span>
            </div>
            <div>
              <span className="text-gray-500">Client:</span>{' '}
              <span className="font-medium text-gray-100">{selected.client?.name}</span>
              {selected.client?.company && (
                <span className="ml-1 text-gray-500">({selected.client.company})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Status:</span>
              <StatusBadge status={selected.status} />
            </div>
            {selected.description && (
              <div>
                <span className="text-gray-500">Description:</span>
                <p className="mt-1 text-gray-300">{selected.description}</p>
              </div>
            )}
            <div className="flex gap-6">
              <div>
                <span className="text-gray-500">Start:</span>{' '}
                <span className="text-gray-200">{new Date(selected.startDate).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-gray-500">End:</span>{' '}
                <span className="text-gray-200">
                  {selected.endDate ? new Date(selected.endDate).toLocaleDateString() : 'Ongoing'}
                </span>
              </div>
            </div>
            {Array.isArray(selected.assignedUsers) && selected.assignedUsers.length > 0 && (
              <div>
                <span className="text-gray-500">Assigned Staff:</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {selected.assignedUsers.map((u) => (
                    <span
                      key={u.id}
                      className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: colorFromId(u.id) }}
                    >
                      {u.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(selected.milestones) && selected.milestones.length > 0 && (
              <div>
                <span className="text-gray-500">Milestones:</span>
                <ul className="mt-1 space-y-1">
                  {selected.milestones.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-gray-300">
                      <span className="text-amber-400">⬥</span>
                      {m.title}
                      <span className="text-gray-500">—</span>
                      {new Date(m.date).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    active:    'bg-emerald-500/20 text-emerald-400',
    complete:  'bg-blue-500/20 text-blue-400',
    'on-hold': 'bg-amber-500/20 text-amber-400',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-700 text-gray-400'}`}>
      {status}
    </span>
  );
}
