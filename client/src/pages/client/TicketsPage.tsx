import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ticketsApi } from '../../api/tickets';
import { PageHeader } from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import { PageSpinner } from '../../components/Spinner';
import { formatDate } from '../../utils/formatters';
import { Plus, Paperclip, Ticket } from 'lucide-react';

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'complete', label: 'Complete' },
  { value: 'out_of_scope', label: 'Out of Scope' },
];

export default function TicketsPage() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', statusFilter],
    queryFn: () => ticketsApi.getAll(statusFilter ? { status: statusFilter } : undefined),
  });

  const tickets = data?.data.tickets || [];

  return (
    <div>
      <PageHeader
        title="My Tickets"
        subtitle="All your maintenance requests."
        action={
          <Link to="/tickets/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Ticket
          </Link>
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s.value
                ? 'bg-[#0D3040] text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-[#0D3040]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : tickets.length === 0 ? (
        <div className="card text-center py-16">
          <Ticket className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No tickets found</p>
          {!statusFilter && (
            <Link to="/tickets/new" className="btn-primary inline-block mt-4 text-sm">Submit a Ticket</Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link key={ticket.id} to={`/tickets/${ticket.id}`} className="card block hover:shadow-md transition-shadow">
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">#{ticket.id}</span>
                    <StatusBadge status={ticket.status} size="sm" />
                  </div>
                  <p className="font-medium text-[#0D3040] truncate">{ticket.title}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(ticket.created_at)}</p>
                </div>
                {(ticket.attachment_count ?? 0) > 0 && (
                  <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                    <Paperclip className="w-3.5 h-3.5" />
                    {ticket.attachment_count}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
