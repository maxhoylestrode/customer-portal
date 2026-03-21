import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ticketsApi } from '../../api/tickets';
import { PageHeader } from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import { PageSpinner } from '../../components/Spinner';
import { formatDate, formatDateTime, getActivityLabel, getScopeLabel } from '../../utils/formatters';
import { Paperclip, Clock, ExternalLink, FileText } from 'lucide-react';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => ticketsApi.getById(Number(id)),
  });

  if (isLoading) return <PageSpinner />;
  if (error || !data) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Ticket not found</p>
        <Link to="/tickets" className="btn-primary inline-block mt-4 text-sm">Back to Tickets</Link>
      </div>
    );
  }

  const { ticket, attachments, activity } = data.data;

  return (
    <div>
      <PageHeader
        title={ticket.title}
        breadcrumb={[{ label: 'Tickets', to: '/tickets' }, { label: `#${ticket.id}`, to: `/tickets/${ticket.id}` }]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Description */}
          <div className="card px-5 py-5">
            <h3 className="font-semibold text-[#0D3040] mb-3 text-sm">Description</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
          </div>

          {/* Admin notes */}
          {ticket.admin_notes && (
            <div className="card px-5 py-5 border-l-4 border-[#1A5276]">
              <h3 className="font-semibold text-[#0D3040] mb-2 text-sm">Notes from Apex Studio</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ticket.admin_notes}</p>
            </div>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="card px-5 py-5">
              <h3 className="font-semibold text-[#0D3040] mb-3 text-sm flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Attachments ({attachments.length})
              </h3>
              <ul className="space-y-2">
                {attachments.map((att) => (
                  <li key={att.id}>
                    <a
                      href={`/api/uploads/${att.filepath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
                    >
                      <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-sm text-[#0D3040] flex-1 truncate group-hover:underline">{att.filename}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Activity timeline */}
          <div className="card px-5 py-5">
            <h3 className="font-semibold text-[#0D3040] mb-4 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Activity
            </h3>
            <ul className="space-y-3">
              {activity.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#1A5276] mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{getActivityLabel(event.action)}</span>
                      {event.detail && <span className="text-gray-500"> — {event.detail}</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {event.user_name || 'System'} · {formatDateTime(event.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card px-5 py-5 space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Status</p>
              <StatusBadge status={ticket.status} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Priority</p>
              <PriorityBadge priority={ticket.priority} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Scope</p>
              <p className="text-sm text-gray-700">{getScopeLabel(ticket.scope_flag)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Submitted</p>
              <p className="text-sm text-gray-700">{formatDate(ticket.created_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Last Updated</p>
              <p className="text-sm text-gray-700">{formatDate(ticket.updated_at)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
