import { useEffect, useState, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import api from '../api';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import StatusPill from '../components/tasks/StatusPill';
import { STATUSES, formatDay } from '../constants/tasks';

// Deterministic colour palette for clients / users
const PALETTE = [
  '#1A5276', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];
const colorFromId = (id) => PALETTE[(id ?? 0) % PALETTE.length];

// Built from the shared task constants so the calendar matches every other view.
// (Milestones are amber too, but they're drawn separately below.)
const STATUS_COLORS = {
  ...Object.fromEntries(STATUSES.map((s) => [s.value, { bg: s.hex, border: s.border }])),
  default: { bg: '#6b7280', border: '#4b5563' },
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

    // A task may have no start date: show it on its due date, or failing that
    // the day it was created.
    events.push({
      id: `project-${p.id}`,
      title: p.name,
      start: p.startDate || p.endDate || p.createdAt,
      end: p.startDate && p.endDate ? p.endDate : undefined,
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
        ...STATUSES.map((s) => ({ label: s.label, color: s.hex })),
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
        <h1 className="text-2xl font-bold text-[#0D3040]">Calendar</h1>
        <div className="flex flex-wrap items-center gap-2">
          {currentUser && (
            <button
              onClick={filterUser === String(currentUser.id) ? clearFilters : setMyProjects}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                filterUser === String(currentUser.id)
                  ? 'border-brand-600 bg-brand-100 text-brand-600'
                  : 'border-gray-300 bg-gray-50 text-gray-500 hover:text-gray-800'
              }`}
            >
              {filterUser === String(currentUser.id) ? '✓ My Tasks' : 'My Tasks'}
            </button>
          )}
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-900 focus:border-brand-700 focus:outline-none"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-900 focus:border-brand-700 focus:outline-none"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-900 focus:border-brand-700 focus:outline-none"
          >
            <option value="">All Staff</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select
            value={colorMode}
            onChange={(e) => setColorMode(e.target.value)}
            className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-900 focus:border-brand-700 focus:outline-none"
          >
            <option value="status">Colour: Status</option>
            <option value="client">Colour: Client</option>
            <option value="user">Colour: Staff</option>
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-500 hover:text-gray-800"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Colour legend */}
      {showLegend && legendItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-gray-500">Legend</span>
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-gray-700">{item.label}</span>
            </div>
          ))}
          <button onClick={() => setShowLegend(false)} className="ml-auto text-xs text-gray-400 hover:text-gray-500">
            Hide
          </button>
        </div>
      )}
      {!showLegend && (
        <button onClick={() => setShowLegend(true)} className="text-xs text-gray-500 hover:text-gray-700">
          Show legend
        </button>
      )}

      {/* Calendar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
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

      {/* Task detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Task Details">
        {selected && (
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-500">Task:</span>{' '}
              <span className="font-medium text-gray-900">{selected.name}</span>
            </div>
            <div>
              <span className="text-gray-500">Client:</span>{' '}
              <span className="font-medium text-gray-900">{selected.client?.name}</span>
              {selected.client?.company && (
                <span className="ml-1 text-gray-500">({selected.client.company})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Status:</span>
              <StatusPill status={selected.status} />
            </div>
            {selected.description && (
              <div>
                <span className="text-gray-500">Description:</span>
                <p className="mt-1 text-gray-700">{selected.description}</p>
              </div>
            )}
            <div className="flex gap-6">
              <div>
                <span className="text-gray-500">Start:</span>{' '}
                <span className="text-gray-800">{selected.startDate ? formatDay(selected.startDate, true) : '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">Due:</span>{' '}
                <span className="text-gray-800">{selected.endDate ? formatDay(selected.endDate, true) : 'No date'}</span>
              </div>
            </div>
            <Link
              to={`/staff/tasks/${selected.id}`}
              className="inline-block rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
            >
              Open task →
            </Link>
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
                    <li key={m.id} className="flex items-center gap-2 text-gray-700">
                      <span className="text-amber-700">⬥</span>
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
