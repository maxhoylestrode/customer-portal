// NOTE: "Project" in the database/API is shown to users as a "Task".
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import TaskFormModal from '../components/tasks/TaskFormModal';
import { Avatar } from '../components/tasks/AssigneeAvatars';
import SectionCard, { EmptyLine } from '../components/dashboard/SectionCard';
import KpiTile from '../components/dashboard/KpiTile';
import AttentionPanel from '../components/dashboard/AttentionPanel';
import TaskListMini from '../components/dashboard/TaskListMini';
import ComingUpList from '../components/dashboard/ComingUpList';
import StackedBar from '../components/dashboard/StackedBar';
import WorkloadBars from '../components/dashboard/WorkloadBars';
import MonthBars from '../components/dashboard/MonthBars';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';
import { STATUSES, statusOf } from '../constants/tasks';

const TICKET_SEGMENTS = {
  pending: { label: 'Pending', color: '#f59e0b' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  complete: { label: 'Complete', color: '#10b981' },
  out_of_scope: { label: 'Out of Scope', color: '#9ca3af' },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// The one dashboard for admin, staff and sales. The server only sends the
// sections a role may see, so a `null` section is simply not drawn.
export default function DashboardPage() {
  const { user } = useAuth();
  const [showTaskForm, setShowTaskForm] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => api.get('/dashboard/overview').then((r) => r.data),
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-gray-500">Could not load the dashboard.</p>
        <button onClick={() => refetch()} className="btn-secondary text-sm">
          Try again
        </button>
      </div>
    );
  }

  const isSales = data.role === 'sales';
  const firstName = (data.userName || user?.name || '').split(' ')[0];
  const dateLine = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      {/* Greeting + quick actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-700">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">{dateLine}</p>
        </div>
        <div className="flex gap-2">
          {!isSales && (
            <button onClick={() => setShowTaskForm(true)} className="btn-primary inline-flex items-center gap-1.5 text-sm">
              <Plus className="h-4 w-4" /> New task
            </button>
          )}
          <Link to="/staff/clients" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
            <Plus className="h-4 w-4" /> Add client
          </Link>
        </div>
      </div>

      {/* 1. Does anything need me right now? */}
      {data.attention && <AttentionPanel attention={data.attention} />}

      {/* 2. How are we doing? */}
      <div className={`grid grid-cols-2 gap-4 ${data.kpis.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
        {data.kpis.map((k) => (
          <KpiTile key={k.key} kpi={k} />
        ))}
      </div>

      {/* 3 + 4. My tasks and what's coming up */}
      <div className="grid gap-6 lg:grid-cols-2">
        {data.myTasks && (
          <SectionCard
            title={`My tasks${data.myTasksTotal ? ` (${data.myTasksTotal})` : ''}`}
            linkTo="/staff/tasks?mine=1"
          >
            {data.myTasks.length === 0 ? (
              <EmptyLine>No tasks assigned to you</EmptyLine>
            ) : (
              <TaskListMini tasks={data.myTasks} />
            )}
          </SectionCard>
        )}

        <SectionCard
          title="Coming up (next 14 days)"
          className={data.myTasks ? '' : 'lg:col-span-2'}
          linkTo={isSales ? '/staff/meetings' : '/staff/calendar'}
          linkLabel={isSales ? 'Meetings' : 'Calendar'}
        >
          {data.comingUp.length === 0 ? (
            <EmptyLine>Nothing due in the next two weeks</EmptyLine>
          ) : (
            <ComingUpList items={data.comingUp} />
          )}
        </SectionCard>
      </div>

      {/* Task pipeline */}
      {data.pipeline && (
        <SectionCard title="Task pipeline" linkTo="/staff/tasks">
          <StackedBar
            emptyLabel="No tasks yet"
            segments={data.pipeline.map((p) => ({
              label: statusOf(p.status).label,
              value: p.count,
              color: STATUSES.find((s) => s.value === p.status)?.hex,
            }))}
          />
        </SectionCard>
      )}

      {/* 5. Workload and tickets */}
      {(data.workload || data.tickets) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {data.workload && (
            <SectionCard title="Team workload">
              {data.workload.length === 0 ? <EmptyLine>No staff yet</EmptyLine> : <WorkloadBars people={data.workload} />}
            </SectionCard>
          )}

          {data.tickets && (
            <SectionCard title="Tickets" linkTo="/admin/tickets" linkLabel="All tickets">
              <StackedBar
                emptyLabel="No tickets yet"
                segments={data.tickets.byStatus.map((s) => ({
                  label: TICKET_SEGMENTS[s.status]?.label ?? s.status,
                  value: s.count,
                  color: TICKET_SEGMENTS[s.status]?.color ?? '#9ca3af',
                }))}
              />
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium text-gray-500">New tickets, last 6 months</p>
                <MonthBars data={data.tickets.monthly} />
              </div>
              {data.tickets.oldestWaiting.length > 0 && (
                <div className="mt-5 border-t border-gray-100 pt-3">
                  <p className="mb-1 text-xs font-medium text-gray-500">Waiting longest</p>
                  <ul className="divide-y divide-gray-50">
                    {data.tickets.oldestWaiting.map((t) => (
                      <li key={t.id}>
                        <Link to={`/admin/tickets/${t.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-brand-600">
                          <span className="min-w-0 truncate text-sm text-gray-800">
                            #{t.id} {t.title}
                            <span className="text-gray-400"> · {t.clientName}</span>
                          </span>
                          <span className={`shrink-0 text-xs ${t.daysWaiting >= 7 ? 'font-medium text-red-500' : 'text-gray-500'}`}>
                            {t.daysWaiting === 0 ? 'today' : `${t.daysWaiting}d`}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>
          )}
        </div>
      )}

      {/* Sales: their own referred clients */}
      {isSales && data.referredClients && (
        <SectionCard title="My referred clients" linkTo="/staff/clients" linkLabel="Clients">
          {data.referredClients.length === 0 ? (
            <EmptyLine>No referred clients yet</EmptyLine>
          ) : (
            <ul className="-mx-2 divide-y divide-gray-50">
              {data.referredClients.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <Link to={`/staff/clients/${c.id}`} className="flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.company || '—'}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">10%</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {/* Recently added clients */}
      <SectionCard title={isSales ? 'Recently added by you' : 'Recently added clients'} linkTo="/staff/clients">
        {data.recentClients.length === 0 ? (
          <EmptyLine>No clients yet</EmptyLine>
        ) : (
          <ul className="-mx-2 divide-y divide-gray-50">
            {data.recentClients.map((c) => (
              <li key={c.id}>
                <Link to={`/staff/clients/${c.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-gray-50">
                  <Avatar user={{ id: c.id, name: c.name }} ring={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{c.name}</p>
                    <p className="truncate text-xs text-gray-500">{c.company || '—'}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">
                    {new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <TaskFormModal
        open={showTaskForm}
        onClose={() => setShowTaskForm(false)}
        onSaved={() => {
          setShowTaskForm(false);
          refetch();
        }}
      />
    </div>
  );
}
