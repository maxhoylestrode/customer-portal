import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ticketsApi } from '../../api/tickets';
import { PageHeader } from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import { PageSpinner } from '../../components/Spinner';
import { formatDate } from '../../utils/formatters';
import { Ticket, Paperclip } from 'lucide-react';

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'complete', label: 'Complete' },
  { value: 'out_of_scope', label: 'Out of Scope' },
];

export default function AdminTicketsPage() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tickets', statusFilter],
    queryFn: () => ticketsApi.getAll(statusFilter ? { status: statusFilter } : undefined),
  });

  const tickets = data?.data.tickets || [];

  return (
    <div>
      <PageHeader title="All Tickets" subtitle={`${tickets.length} ticket${tickets.length !== 1 ? 's' : ''} found`} />

      {/* Status filter */}
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
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400">{ticket.id}</td>
                  <td className="px-4 py-3 max-w-xs">
                    <Link to={`/admin/tickets/${ticket.id}`} className="font-medium text-[#0D3040] hover:underline flex items-center gap-1.5">
                      <span className="truncate">{ticket.title}</span>
                      {(ticket.attachment_count ?? 0) > 0 && <Paperclip className="w-3 h-3 text-gray-400 shrink-0" />}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">
                    <Link to={`/admin/users/${ticket.user_id}`} className="hover:text-[#0D3040] hover:underline">
                      {ticket.company_name || ticket.client_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={ticket.status} size="sm" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><PriorityBadge priority={ticket.priority} /></td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs">{formatDate(ticket.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
