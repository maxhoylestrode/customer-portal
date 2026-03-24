import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import { PageHeader } from '../../components/Layout';
import { PageSpinner } from '../../components/Spinner';
import { formatDateTime, getActivityLabel } from '../../utils/formatters';
import { Clock, Users, Ticket, CheckCircle, AlertTriangle, BarChart2, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats(),
  });

  if (isLoading) return <PageSpinner />;

  const { stats, recentActivity, monthlyTrend, priorityBreakdown } = data!.data;

  const maxMonthlyCount = Math.max(...(monthlyTrend?.map((m) => Number(m.count)) || [1]), 1);

  const priorityColours: Record<string, string> = {
    low: 'bg-gray-400',
    normal: 'bg-blue-500',
    high: 'bg-red-500',
  };
  const totalPriority = priorityBreakdown?.reduce((acc, p) => acc + Number(p.count), 0) || 1;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of all maintenance tickets and clients." />

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Open Tickets" value={Number(stats.pending)} colour="amber" icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} />
        <StatCard label="In Progress" value={Number(stats.in_progress)} colour="blue" icon={<Ticket className="w-5 h-5 text-blue-500" />} />
        <StatCard label="Done This Month" value={Number(stats.completed_this_month)} colour="green" icon={<CheckCircle className="w-5 h-5 text-green-500" />} />
        <StatCard label="Active Clients" value={Number(stats.total_clients) || 0} colour="teal" icon={<Users className="w-5 h-5 text-[#0D3040]" />} />
      </div>

      {/* Second row */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Monthly trend */}
        <div className="card px-5 py-4">
          <h2 className="font-semibold text-[#0D3040] flex items-center gap-2 mb-4 text-sm">
            <TrendingUp className="w-4 h-4" />
            Tickets — Last 6 Months
          </h2>
          {monthlyTrend && monthlyTrend.length > 0 ? (
            <div className="space-y-2">
              {monthlyTrend.map((m) => (
                <div key={m.month_date} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-16 shrink-0">{m.month}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#1A5276] h-2 rounded-full transition-all"
                      style={{ width: `${(Number(m.count) / maxMonthlyCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-[#0D3040] w-6 text-right">{m.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">No ticket data yet</p>
          )}
        </div>

        {/* Status & Priority breakdown */}
        <div className="space-y-4">
          {/* Status breakdown */}
          <div className="card px-5 py-4">
            <h2 className="font-semibold text-[#0D3040] flex items-center gap-2 mb-3 text-sm">
              <BarChart2 className="w-4 h-4" />
              Ticket Status Breakdown
            </h2>
            <div className="space-y-2">
              <BreakdownRow label="Pending" count={Number(stats.pending)} total={Number(stats.total)} colour="bg-amber-400" />
              <BreakdownRow label="In Progress" count={Number(stats.in_progress)} total={Number(stats.total)} colour="bg-blue-500" />
              <BreakdownRow label="Complete" count={Number(stats.total_complete)} total={Number(stats.total)} colour="bg-green-500" />
              <BreakdownRow label="Out of Scope" count={Number(stats.total_out_of_scope)} total={Number(stats.total)} colour="bg-gray-400" />
            </div>
            <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-2">
              {stats.total} total ticket{Number(stats.total) !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Priority breakdown */}
          {priorityBreakdown && priorityBreakdown.length > 0 && (
            <div className="card px-5 py-4">
              <h2 className="font-semibold text-[#0D3040] text-sm mb-3">Priority Breakdown</h2>
              <div className="flex gap-4">
                {priorityBreakdown.map((p) => (
                  <div key={p.priority} className="flex-1 text-center">
                    <div className="relative h-16 flex items-end justify-center mb-1">
                      <div
                        className={`w-8 rounded-t ${priorityColours[p.priority] || 'bg-gray-400'}`}
                        style={{ height: `${Math.max((Number(p.count) / totalPriority) * 60, 4)}px` }}
                      />
                    </div>
                    <p className="text-xs font-semibold text-[#0D3040]">{p.count}</p>
                    <p className="text-xs text-gray-400 capitalize">{p.priority}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activity feed */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#0D3040] flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Recent Activity
          </h2>
          <Link to="/admin/tickets" className="text-sm text-[#1A5276] hover:underline">View all tickets</Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No activity yet</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recentActivity.map((event) => (
              <li key={event.id} className="px-5 py-3 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-[#1A5276] mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{getActivityLabel(event.action)}</span>
                    {event.detail && <span className="text-gray-500"> — {event.detail}</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {(event as { ticket_title?: string }).ticket_title && (
                      <Link to={`/admin/tickets/${event.ticket_id}`} className="text-[#1A5276] hover:underline mr-1">
                        {(event as { ticket_title?: string }).ticket_title}
                      </Link>
                    )}
                    · {event.user_name || 'System'} · {formatDateTime(event.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, colour, icon }: { label: string; value: number; colour: string; icon: React.ReactNode }) {
  const bg: Record<string, string> = { amber: 'bg-amber-50', blue: 'bg-blue-50', green: 'bg-green-50', teal: 'bg-[#D6EAF8]' };
  return (
    <div className="card px-5 py-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg ${bg[colour]}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-[#0D3040]">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function BreakdownRow({ label, count, total, colour }: { label: string; count: number; total: number; colour: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`${colour} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-[#0D3040] w-6 text-right">{count}</span>
    </div>
  );
}
