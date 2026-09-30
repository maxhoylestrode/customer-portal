import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const isSales = user?.role === 'sales';
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then((r) => { setStats(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );

  if (!stats)
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Could not load dashboard data. Please refresh.</p>
      </div>
    );

  const projectTotal = (stats.activeProjects || 0) + (stats.completeProjects || 0) + (stats.onHoldProjects || 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/staff/clients"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Add Client
          </Link>
        </div>
      </div>

      {/* ── Stats grid ── */}
      {isSales ? (
        // Sales view: personal stats
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <StatCard label="My Referred Clients" value={stats.estimatedCommission ?? 0} color="emerald"
            sub="clients you introduced" icon={<PeopleIcon />} />
          <StatCard label="Total Clients (Portal)" value={stats.totalClients} color="brand"
            sub="all clients in the system" icon={<ClientIcon />} />
          <StatCard label="Commission Rate" value="10%" color="amber"
            sub="per referred client deal" icon={<CommissionIcon />} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <StatCard label="Total Clients" value={stats.totalClients} color="brand" icon={<ClientIcon />} />
          <StatCard label="Active Projects" value={stats.activeProjects || 0} color="emerald" icon={<ProjectIcon />} />
          <StatCard label="Completed" value={stats.completeProjects || 0} color="blue" icon={<CheckIcon />} />
          <StatCard label="Upcoming Deadlines" value={stats.upcomingDeadlines?.length || 0} color="amber" icon={<DeadlineIcon />} />
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Monthly clients bar chart — spans 2 cols */}
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-surface p-5">
          <h2 className="mb-4 text-base font-semibold">New Clients — Last 6 Months</h2>
          <BarChart data={stats.monthlyClients || []} />
        </div>

        {/* Project status / Sales commission side panel */}
        <div className="rounded-xl border border-gray-800 bg-surface p-5">
          {isSales ? (
            <>
              <h2 className="mb-4 text-base font-semibold">My Referred Clients</h2>
              {(!stats.myReferredClients || stats.myReferredClients.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <PeopleIcon className="mb-2 h-10 w-10 text-gray-700" />
                  <p className="text-sm text-gray-500">No referred clients yet.</p>
                  <Link to="/staff/clients" className="mt-2 text-sm text-brand-400 hover:underline">Add your first client →</Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {stats.myReferredClients.slice(0, 8).map((c) => (
                    <li key={c.id}>
                      <Link to={`/staff/clients/${c.id}`}
                        className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface-light">
                        <div>
                          <p className="text-sm font-medium text-gray-200">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.company || '—'}</p>
                        </div>
                        <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs text-emerald-400">10%</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <h2 className="mb-4 text-base font-semibold">Project Status</h2>
              {projectTotal === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No projects yet.</p>
              ) : (
                <div className="space-y-4">
                  <DonutChart
                    segments={[
                      { label: 'Active',   value: stats.activeProjects  || 0, color: '#10b981' },
                      { label: 'Complete', value: stats.completeProjects || 0, color: '#3b82f6' },
                      { label: 'On Hold',  value: stats.onHoldProjects  || 0, color: '#f59e0b' },
                    ]}
                    total={projectTotal}
                  />
                  <div className="space-y-2 pt-2">
                    {[
                      { label: 'Active',   value: stats.activeProjects  || 0, color: 'bg-emerald-500' },
                      { label: 'Complete', value: stats.completeProjects || 0, color: 'bg-blue-500' },
                      { label: 'On Hold',  value: stats.onHoldProjects  || 0, color: 'bg-amber-500' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                          <span className="text-gray-400">{label}</span>
                        </div>
                        <span className="font-medium text-gray-200">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Lower row ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Clients */}
        <div className="rounded-xl border border-gray-800 bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Recent Clients</h2>
            <Link to="/staff/clients" className="text-xs text-brand-400 hover:underline">View all →</Link>
          </div>
          {stats.recentClients.length === 0 ? (
            <p className="text-sm text-gray-500">No clients yet.</p>
          ) : (
            <ul className="space-y-2">
              {stats.recentClients.map((c) => (
                <li key={c.id}>
                  <Link to={`/staff/clients/${c.id}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 transition hover:bg-surface-light">
                    <div className="flex items-center gap-3">
                      <MiniAvatar name={c.name} id={c.id} />
                      <div>
                        <p className="text-sm font-medium text-gray-200">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.company || '—'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-600">{new Date(c.createdAt).toLocaleDateString()}</p>
                      {c.salesPerson && (
                        <span className="rounded-full bg-emerald-600/20 px-1.5 py-0.5 text-xs text-emerald-400">{c.salesPerson.name}</span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Projects or Upcoming Deadlines */}
        {!isSales && (
          <div className="rounded-xl border border-gray-800 bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {stats.upcomingDeadlines?.length > 0 ? 'Upcoming Deadlines' : 'Recent Projects'}
              </h2>
            </div>
            {stats.upcomingDeadlines?.length > 0 ? (
              <ul className="space-y-2">
                {stats.upcomingDeadlines.map((p) => {
                  const daysLeft = Math.ceil((new Date(p.endDate) - new Date()) / (1000 * 60 * 60 * 24));
                  return (
                    <li key={p.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-surface-light">
                      <div>
                        <p className="text-sm font-medium text-gray-200">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.client?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-amber-400">{new Date(p.endDate).toLocaleDateString()}</p>
                        <p className={`text-xs ${daysLeft <= 7 ? 'text-red-400' : 'text-gray-500'}`}>
                          {daysLeft <= 0 ? 'Overdue' : `${daysLeft}d left`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : stats.recentProjects?.length > 0 ? (
              <ul className="space-y-2">
                {stats.recentProjects.map((p) => (
                  <li key={p.id}>
                    <Link to={`/staff/clients/${p.client.id}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 transition hover:bg-surface-light">
                      <div>
                        <p className="text-sm font-medium text-gray-200">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.client.name}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No projects yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bar Chart (pure SVG) ───────────────────────────────────────────────────────
function BarChart({ data }) {
  if (!data || data.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">No data yet.</p>;

  const max = Math.max(...data.map((d) => d.count), 1);
  const chartH = 140;
  const barW   = 32;
  const gap    = 16;
  const totalW = data.length * (barW + gap) - gap;
  const padL   = 28;
  const padB   = 28;

  return (
    <div className="overflow-x-auto">
      <svg
        width={totalW + padL + 16}
        height={chartH + padB + 8}
        className="overflow-visible"
      >
        {/* Y-axis guide lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = 4 + chartH * (1 - frac);
          const val = Math.round(frac * max);
          return (
            <g key={frac}>
              <line x1={padL} y1={y} x2={padL + totalW} y2={y} stroke="#374151" strokeWidth={1} strokeDasharray="4 3" />
              <text x={padL - 6} y={y + 4} textAnchor="end" fill="#6b7280" fontSize={10}>{val}</text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map(({ label, count }, i) => {
          const x   = padL + i * (barW + gap);
          const barH = Math.max(4, (count / max) * chartH);
          const y   = 4 + chartH - barH;
          return (
            <g key={label}>
              {/* Bar */}
              <rect x={x} y={y} width={barW} height={barH}
                rx={4} fill="#6366f1" opacity={count === 0 ? 0.2 : 0.85} />
              {/* Count label on top */}
              {count > 0 && (
                <text x={x + barW / 2} y={y - 5} textAnchor="middle" fill="#a5b4fc" fontSize={11} fontWeight="600">
                  {count}
                </text>
              )}
              {/* Month label */}
              <text x={x + barW / 2} y={4 + chartH + padB - 10} textAnchor="middle" fill="#9ca3af" fontSize={11}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Donut Chart (pure SVG) ────────────────────────────────────────────────────
function DonutChart({ segments, total }) {
  const size = 100;
  const r    = 38;
  const cx   = size / 2;
  const cy   = size / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const pieces = segments.map(({ label, value, color }) => {
    const frac = total > 0 ? value / total : 0;
    const dash = circ * frac;
    const piece = { label, value, color, dasharray: `${dash} ${circ - dash}`, offset: circ * (1 - offset) };
    offset += frac;
    return piece;
  });

  return (
    <div className="flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="#1f2937" strokeWidth={14} />
        {pieces.map(({ label, color, dasharray, offset: strokeOffset }) => (
          <circle
            key={label}
            cx={cx} cy={cy} r={r}
            fill="transparent"
            stroke={color}
            strokeWidth={14}
            strokeDasharray={dasharray}
            strokeDashoffset={strokeOffset}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#f9fafb" fontSize={16} fontWeight="bold">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#6b7280" fontSize={8}>projects</text>
      </svg>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, sub, icon }) {
  const colors = {
    brand:   'border-brand-600/30   bg-brand-600/10   text-brand-400',
    emerald: 'border-emerald-600/30 bg-emerald-600/10 text-emerald-400',
    amber:   'border-amber-600/30   bg-amber-600/10   text-amber-400',
    blue:    'border-blue-600/30    bg-blue-600/10    text-blue-400',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
          <p className="mt-1 text-3xl font-bold">{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
        </div>
        {icon && <div className="opacity-40">{icon}</div>}
      </div>
    </div>
  );
}

function MiniAvatar({ name, id }) {
  const palette = ['bg-violet-600','bg-indigo-600','bg-blue-600','bg-teal-600','bg-emerald-600','bg-amber-600','bg-rose-600'];
  const bg = palette[(name?.charCodeAt(0) || 0) % palette.length];
  return (
    <div className={`${bg} flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase text-white`}>
      {name?.[0] || '?'}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    active:    'bg-emerald-500/20 text-emerald-400',
    complete:  'bg-blue-500/20    text-blue-400',
    'on-hold': 'bg-amber-500/20   text-amber-400',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-700 text-gray-400'}`}>
      {status}
    </span>
  );
}

// ── Mini icons ────────────────────────────────────────────────────────────────
const ic = (d) => ({ className } = {}) => (
  <svg className={className || 'h-7 w-7'} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const ClientIcon    = ic('M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0');
const ProjectIcon   = ic('M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379');
const CheckIcon     = ic('M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z');
const DeadlineIcon  = ic('M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5');
const PeopleIcon    = ic('M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z');
const CommissionIcon = ic('M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z');
