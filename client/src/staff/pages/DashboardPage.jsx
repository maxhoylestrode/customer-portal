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
import { KpiStrip } from '../components/dashboard/KpiTile';
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

  const pipelineSegments = data.pipeline?.map((p) => ({
    label: statusOf(p.status).label,
    value: p.count,
    color: STATUSES.find((s) => s.value === p.status)?.hex,
  }));

  return (
    <div className="space-y-5">
      {/* Greeting, what needs me, quick actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2.5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {greeting()}
              {firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">{dateLine}</p>
          </div>
          {data.attention && <AttentionPanel attention={data.attention} />}
        </div>
        <div className="flex gap-2">
          {!isSales && (
            <button onClick={() => setShowTaskForm(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> New task
            </button>
          )}
          <Link to="/staff/clients" className="btn-secondary">
            <Plus className="h-4 w-4" /> Add client
          </Link>
        </div>
      </div>

      {/* Headline numbers, with the task pipeline along the bottom */}
      <KpiStrip kpis={data.kpis}>
        {pipelineSegments && (
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
            <Link to="/staff/tasks" className="shrink-0 pt-px text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500 hover:text-gray-700">
              Task pipeline
            </Link>
            <div className="flex-1">
              <StackedBar emptyLabel="No tasks yet" segments={pipelineSegments} />
            </div>
          </div>
        )}
      </KpiStrip>

      {/* What I'm working on and what's next */}
      <div className="grid gap-5 xl:grid-cols-3">
        {data.myTasks && (
          <SectionCard title="My tasks" count={data.myTasksTotal || null} linkTo="/staff/tasks?mine=1" className="xl:col-span-2">
            {data.myTasks.length === 0 ? (
              <EmptyLine>No tasks assigned to you</EmptyLine>
            ) : (
              <TaskListMini tasks={data.myTasks} />
            )}
          </SectionCard>
        )}

        <SectionCard
          title="Coming up"
          count="next 14 days"
          className={data.myTasks ? '' : 'xl:col-span-3'}
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

      {/* Tickets, team and clients side by side */}
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
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
            {data.tickets.oldestWaiting.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500">Waiting longest</p>
                <ul className="divide-y divide-gray-50">
                  {data.tickets.oldestWaiting.map((t) => (
                    <li key={t.id}>
                      <Link to={`/admin/tickets/${t.id}`} className="group flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0 truncate text-sm text-gray-800 group-hover:text-brand-600">
                          <span className="num text-gray-400">#{t.id}</span> {t.title}
                          <span className="text-gray-400"> · {t.clientName}</span>
                        </span>
                        <span className={`num shrink-0 text-xs ${t.daysWaiting >= 7 ? 'font-medium text-red-500' : 'text-gray-500'}`}>
                          {t.daysWaiting === 0 ? 'today' : `${t.daysWaiting}d`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-auto border-t border-line pt-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500">New, last 6 months</p>
              <MonthBars data={data.tickets.monthly} />
            </div>
          </SectionCard>
        )}

        {data.workload && (
          <SectionCard title="Team workload">
            {data.workload.length === 0 ? <EmptyLine>No staff yet</EmptyLine> : <WorkloadBars people={data.workload} />}
          </SectionCard>
        )}

        {isSales && data.referredClients && (
          <SectionCard title="My referred clients" linkTo="/staff/clients" linkLabel="Clients">
            {data.referredClients.length === 0 ? (
              <EmptyLine>No referred clients yet</EmptyLine>
            ) : (
              <ul className="-mx-2 divide-y divide-gray-50">
                {data.referredClients.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <Link to={`/staff/clients/${c.id}`} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-gray-50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">{c.name}</p>
                        <p className="truncate text-xs text-gray-500">{c.company || '—'}</p>
                      </div>
                      <span className="num rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">10%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        <SectionCard title={isSales ? 'Recently added by you' : 'Recently added clients'} linkTo="/staff/clients">
          {data.recentClients.length === 0 ? (
            <EmptyLine>No clients yet</EmptyLine>
          ) : (
            <ul className="-mx-2 divide-y divide-gray-50">
              {data.recentClients.map((c) => (
                <li key={c.id}>
                  <Link to={`/staff/clients/${c.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
                    <Avatar user={{ id: c.id, name: c.name }} ring={false} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">{c.name}</p>
                      <p className="truncate text-xs text-gray-500">{c.company || '—'}</p>
                    </div>
                    <span className="num shrink-0 text-xs text-gray-400">
                      {new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

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
