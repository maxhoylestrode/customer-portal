import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import { PageHeader } from '../../components/Layout';
import { PageSpinner } from '../../components/Spinner';
import { formatDateTime, getActivityLabel } from '../../utils/formatters';
import { Clock, Users, Ticket, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats(),
  });

  if (isLoading) return <PageSpinner />;

  const { stats, recentActivity } = data!.data;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of all maintenance tickets and clients." />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Open Tickets" value={stats.pending} colour="amber" icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} />
        <StatCard label="In Progress" value={stats.in_progress} colour="blue" icon={<Ticket className="w-5 h-5 text-blue-500" />} />
        <StatCard label="Done This Month" value={stats.completed_this_month} colour="green" icon={<CheckCircle className="w-5 h-5 text-green-500" />} />
        <StatCard label="Active Clients" value={stats.total_clients || 0} colour="teal" icon={<Users className="w-5 h-5 text-[#0D3040]" />} />
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
