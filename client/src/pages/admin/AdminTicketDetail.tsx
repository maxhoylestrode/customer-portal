import React, { useState, useEffect } from 'react';
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
import TicketChat from '../../components/TicketChat';
import PillSelect, { STATUS_OPTIONS, SCOPE_OPTIONS, PRIORITY_OPTIONS } from '../../components/PillSelect';
import { formatDate, getScopeLabel } from '../../utils/formatters';
import {
  Paperclip, Trash2, ExternalLink, FileText, X,
  Send, User, AlertCircle, CheckCircle2, Tag, ArrowRightLeft,
} from 'lucide-react';

interface FormState {
  status: string;
  scope_flag: string;
  priority: string;
}

export default function AdminTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Local pending state — only committed on button click
  const [form, setForm] = useState<FormState | null>(null);
  const [notesValue, setNotesValue] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ticket', id],
    queryFn: () => ticketsApi.getById(Number(id)),
  });

  // Sync form with server state when data arrives or refreshes after save
  useEffect(() => {
    if (data?.data?.ticket) {
      const { ticket } = data.data;
      setForm({ status: ticket.status, scope_flag: ticket.scope_flag, priority: ticket.priority });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) => ticketsApi.update(Number(id), updates as never),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
      toast('Ticket updated', 'success');
      setNotesValue(null);
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

  if (isLoading || !form) return <PageSpinner />;
  if (!data) return <div className="text-center py-16"><p className="text-gray-500">Ticket not found</p></div>;

  const { ticket, attachments } = data.data;
  const notes = notesValue !== null ? notesValue : (ticket.admin_notes || '');

  // Compute pending changes
  const changes: Record<string, string> = {};
  if (form.status !== ticket.status) changes.status = form.status;
  if (form.scope_flag !== ticket.scope_flag) changes.scope_flag = form.scope_flag;
  if (form.priority !== ticket.priority) changes.priority = form.priority;
  if (notes !== (ticket.admin_notes || '')) changes.admin_notes = notes;
  const hasChanges = Object.keys(changes).length > 0;
  const willSendEmail = 'status' in changes;
  const changeCount = Object.keys(changes).length;

  function handleUpdate() {
    if (!hasChanges) return;
    updateMutation.mutate(changes);
  }

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  const scopeLabel: Record<string, string> = {
    unknown: 'Unknown',
    in_scope: 'In Scope',
    out_of_scope: 'Out of Scope',
  };

  return (
    <div>
      <PageHeader
        title={`#${ticket.id}: ${ticket.title}`}
        breadcrumb={[
          { label: 'Tickets', to: '/admin/tickets' },
          { label: `#${ticket.id}`, to: `/admin/tickets/${ticket.id}` },
        ]}
        action={
          <button
            onClick={() => setDeleteOpen(true)}
            className="btn-danger flex items-center gap-2 text-sm py-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main content ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Description */}
          <div className="card px-5 py-5 border-l-4 border-[#0D3040]">
            <h3 className="font-semibold text-[#0D3040] mb-3 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Description
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
          </div>

          {/* Admin notes */}
          <div className="card px-5 py-5">
            <h3 className="font-semibold text-[#0D3040] mb-1 text-sm">
              Admin Notes{' '}
              <span className="font-normal text-gray-400 text-xs">(visible to client)</span>
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              These notes will be shown to the client on their ticket view.
            </p>
            <textarea
              rows={4}
              className="input resize-none"
              placeholder="Add notes visible to the client here…"
              value={notes}
              onChange={(e) => setNotesValue(e.target.value)}
            />
            {notes !== (ticket.admin_notes || '') && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-2">
                <AlertCircle className="w-3 h-3" />
                Unsaved — click <strong className="mx-0.5">Update Ticket</strong> to save
              </p>
            )}
          </div>

          {/* Attachments */}
          <div className="card px-5 py-5">
            <h3 className="font-semibold text-[#0D3040] mb-3 text-sm flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Attachments
              <span className="text-gray-400 font-normal ml-0.5">({attachments.length})</span>
            </h3>
            {attachments.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No attachments</p>
            ) : (
              <ul className="space-y-2">
                {attachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5 hover:bg-gray-100 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <a
                      href={`/api/tickets/${att.ticket_id}/attachments/${att.id}`}
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
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Remove attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Chat */}
          <TicketChat ticketId={ticket.id} />
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">

          {/* Manage Ticket */}
          <div className="card px-5 py-5 space-y-4">
            <h3 className="font-semibold text-[#0D3040] text-sm border-b border-gray-100 pb-3 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Manage Ticket
            </h3>

            {/* Current live badges */}
            <div className="flex flex-wrap gap-2 py-1">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-600 border border-gray-200">
                {scopeLabel[ticket.scope_flag] || ticket.scope_flag}
              </span>
            </div>

            {hasChanges && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
                <ArrowRightLeft className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  {changeCount} unsaved {changeCount === 1 ? 'change' : 'changes'} — click Update Ticket to apply
                </span>
              </div>
            )}

            <PillSelect label="Status" options={STATUS_OPTIONS} value={form.status} original={ticket.status} onChange={(v) => setField('status', v)} />
            <PillSelect label="Scope" options={SCOPE_OPTIONS} value={form.scope_flag} original={ticket.scope_flag} onChange={(v) => setField('scope_flag', v)} />
            <PillSelect label="Priority" options={PRIORITY_OPTIONS} value={form.priority} original={ticket.priority} onChange={(v) => setField('priority', v)} />

            {/* Submit */}
            <div className="pt-1 border-t border-gray-100 space-y-2">
              {willSendEmail && (
                <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  A status update email will be sent to the client
                </div>
              )}
              <button
                onClick={handleUpdate}
                disabled={!hasChanges || updateMutation.isPending}
                className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateMutation.isPending ? (
                  <Spinner className="w-4 h-4" />
                ) : (
                  <>
                    {willSendEmail ? (
                      <Send className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Update Ticket
                    {hasChanges && (
                      <span className="bg-white/20 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                        {changeCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Client info */}
          <div className="card px-5 py-5 space-y-3">
            <h3 className="font-semibold text-[#0D3040] text-sm border-b border-gray-100 pb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Client
            </h3>
            <div>
              <Link
                to={`/admin/users/${ticket.user_id}`}
                className="text-sm font-medium text-[#1A5276] hover:underline"
              >
                {ticket.company_name || ticket.client_name}
              </Link>
              <p className="text-xs text-gray-500 mt-0.5">{ticket.client_email}</p>
              {ticket.website_url && (
                <a
                  href={ticket.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#1A5276] hover:underline flex items-center gap-1 mt-1.5"
                >
                  {ticket.website_url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="pt-2 border-t border-gray-100 space-y-1">
              <p className="text-xs text-gray-400">Submitted {formatDate(ticket.created_at)}</p>
              <p className="text-xs text-gray-400">Updated {formatDate(ticket.updated_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete modal */}
      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Ticket" size="sm">
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete ticket <strong>#{ticket.id}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setDeleteOpen(false)} className="btn-secondary text-sm">
            Cancel
          </button>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="btn-danger text-sm flex items-center gap-2"
          >
            {deleteMutation.isPending ? (
              <Spinner className="w-3.5 h-3.5" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
