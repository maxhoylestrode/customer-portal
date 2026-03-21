import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ticketsApi } from '../../api/tickets';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import { PageSpinner } from '../../components/Spinner';
import { formatDate } from '../../utils/formatters';
import { Ticket, Clock, CheckCircle, Plus } from 'lucide-react';

export default function ClientDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => ticketsApi.getAll(),
  });

  const tickets = data?.data.tickets || [];
  const pending = tickets.filter((t) => t.status === 'pending').length;
  const inProgress = tickets.filter((t) => t.status === 'in_progress').length;
  const complete = tickets.filter((t) => t.status === 'complete').length;
  const recent = [...tickets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  if (isLoading) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0]}`}
        subtitle="Manage your website maintenance requests here."
        action={
          <Link to="/tickets/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Ticket
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Open" value={pending} icon={<Clock className="w-5 h-5 text-amber-500" />} colour="amber" />
        <StatCard label="In Progress" value={inProgress} icon={<Ticket className="w-5 h-5 text-blue-500" />} colour="blue" />
        <StatCard label="Completed" value={complete} icon={<CheckCircle className="w-5 h-5 text-green-500" />} colour="green" />
      </div>

      {/* Recent tickets */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#0D3040]">Recent Tickets</h2>
          <Link to="/tickets" className="text-sm text-[#1A5276] hover:underline">View all</Link>
        </div>
        {recent.length === 0 ? (
          <div className="text-center py-12">
            <Ticket className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No tickets yet</p>
            <Link to="/tickets/new" className="btn-primary inline-block mt-4 text-sm">Submit Your First Ticket</Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recent.map((ticket) => (
              <li key={ticket.id}>
                <Link to={`/tickets/${ticket.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0D3040] truncate">{ticket.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">#{ticket.id} · {formatDate(ticket.created_at)}</p>
                  </div>
                  <StatusBadge status={ticket.status} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, colour }: { label: string; value: number; icon: React.ReactNode; colour: string }) {
  const bg: Record<string, string> = { amber: 'bg-amber-50', blue: 'bg-blue-50', green: 'bg-green-50' };
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
