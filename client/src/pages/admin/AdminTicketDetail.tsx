import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '../../api/tickets';
import { PageHeader } from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import { PageSpinner } from '../../components/Spinner';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { formatDate, formatDateTime, getActivityLabel, getScopeLabel } from '../../utils/formatters';
import { Paperclip, Trash2, ExternalLink, Clock, FileText, X } from 'lucide-react';

export default function AdminTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ticket', id],
    queryFn: () => ticketsApi.getById(Number(id)),
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) => ticketsApi.update(Number(id), updates as never),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
      toast('Ticket updated', 'success');
    },
    onError: () => toast('Failed to update ticket', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => ticketsApi.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
      toast('Ticket deleted', 'success');
      navigate('/admin/tickets');
    },
    onError: () => toast('Failed to delete ticket', 'error'),
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: number) => ticketsApi.deleteAttachment(Number(id), attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ticket', id] });
      toast('Attachment removed', 'success');
    },
    onError: () => toast('Failed to remove attachment', 'error'),
  });

  const [notesValue, setNotesValue] = useState<string | null>(null);

  if (isLoading) return <PageSpinner />;
  if (!data) return <div className="text-center py-16"><p className="text-gray-500">Ticket not found</p></div>;

  const { ticket, attachments, activity } = data.data;
  const notes = notesValue !== null ? notesValue : (ticket.admin_notes || '');

  function handleField(field: string, value: string) {
    updateMutation.mutate({ [field]: value });
  }

  function saveNotes() {
    updateMutation.mutate({ admin_notes: notes });
    setNotesValue(null);
  }

  return (
    <div>
      <PageHeader
        title={`#${ticket.id}: ${ticket.title}`}
        breadcrumb={[{ label: 'Tickets', to: '/admin/tickets' }, { label: `#${ticket.id}`, to: `/admin/tickets/${ticket.id}` }]}
        action={
          <button onClick={() => setDeleteOpen(true)} className="btn-danger flex items-center gap-2 text-sm py-1.5">
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          {/* Description */}
          <div className="card px-5 py-5">
            <h3 className="font-semibold text-[#0D3040] mb-3 text-sm">Description</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
          </div>

          {/* Admin notes */}
          <div className="card px-5 py-5">
            <h3 className="font-semibold text-[#0D3040] mb-3 text-sm">Admin Notes (visible to client)</h3>
            <textarea
              rows={4}
              className="input resize-none mb-3"
              placeholder="Add notes for the client here…"
              value={notes}
              onChange={(e) => setNotesValue(e.target.value)}
            />
            <button
              onClick={saveNotes}
              disabled={updateMutation.isPending || notes === (ticket.admin_notes || '')}
              className="btn-primary text-sm flex items-center gap-2"
            >
              {updateMutation.isPending ? <Spinner className="w-3 h-3" /> : null}
              Save Notes
            </button>
          </div>

          {/* Attachments */}
          <div className="card px-5 py-5">
            <h3 className="font-semibold text-[#0D3040] mb-3 text-sm flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Attachments ({attachments.length})
            </h3>
            {attachments.length === 0 ? (
              <p className="text-sm text-gray-400">No attachments</p>
            ) : (
              <ul className="space-y-2">
                {attachments.map((att) => (
                  <li key={att.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <a
                      href={`/api/uploads/${att.filepath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#0D3040] flex-1 truncate hover:underline flex items-center gap-1"
                    >
                      {att.filename}
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    </a>
                    <button
                      onClick={() => deleteAttachmentMutation.mutate(att.id)}
                      disabled={deleteAttachmentMutation.isPending}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Activity */}
          <div className="card px-5 py-5">
            <h3 className="font-semibold text-[#0D3040] mb-4 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Activity Log
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

        {/* Sidebar controls */}
        <div className="space-y-4">
          <div className="card px-5 py-5 space-y-4">
            <h3 className="font-semibold text-[#0D3040] text-sm border-b border-gray-100 pb-3">Manage Ticket</h3>

            <div>
              <label className="label text-xs">Status</label>
              <select
                className="input text-sm"
                value={ticket.status}
                onChange={(e) => handleField('status', e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="complete">Complete</option>
                <option value="out_of_scope">Out of Scope</option>
              </select>
            </div>

            <div>
              <label className="label text-xs">Scope</label>
              <select
                className="input text-sm"
                value={ticket.scope_flag}
                onChange={(e) => handleField('scope_flag', e.target.value)}
              >
                <option value="unknown">Unknown</option>
                <option value="in_scope">In Scope</option>
                <option value="out_of_scope">Out of Scope</option>
              </select>
            </div>

            <div>
              <label className="label text-xs">Priority</label>
              <select
                className="input text-sm"
                value={ticket.priority}
                onChange={(e) => handleField('priority', e.target.value)}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="card px-5 py-5 space-y-3">
            <h3 className="font-semibold text-[#0D3040] text-sm border-b border-gray-100 pb-3">Client</h3>
            <div>
              <Link to={`/admin/users/${ticket.user_id}`} className="text-sm font-medium text-[#1A5276] hover:underline">
                {ticket.company_name || ticket.client_name}
              </Link>
              <p className="text-xs text-gray-400 mt-0.5">{ticket.client_email}</p>
              {ticket.website_url && (
                <a href={ticket.website_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-[#1A5276] hover:underline flex items-center gap-1 mt-1">
                  {ticket.website_url} <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400">Submitted {formatDate(ticket.created_at)}</p>
              <p className="text-xs text-gray-400">Updated {formatDate(ticket.updated_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete modal */}
      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Ticket" size="sm">
        <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete ticket <strong>#{ticket.id}</strong>? This cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setDeleteOpen(false)} className="btn-secondary text-sm">Cancel</button>
          <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="btn-danger text-sm flex items-center gap-2">
            {deleteMutation.isPending ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
