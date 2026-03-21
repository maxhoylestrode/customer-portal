import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminApi } from '../../api/admin';
import { PageHeader } from '../../components/Layout';
import Modal from '../../components/Modal';
import { PageSpinner } from '../../components/Spinner';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { formatDate } from '../../utils/formatters';
import { Plus, Users, Globe, Mail, UserX, UserCheck } from 'lucide-react';

const createSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  company_name: z.string().optional(),
  website_url: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  client_notes: z.string().optional(),
});
type CreateFormData = z.infer<typeof createSchema>;

const inviteSchema = z.object({
  email: z.string().email('Valid email required'),
  name: z.string().optional(),
});
type InviteFormData = z.infer<typeof inviteSchema>;

export default function AdminUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.getUsers(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateFormData) => adminApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setCreateOpen(false);
      toast('Client created and invite sent', 'success');
      createForm.reset();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create client';
      toast(msg, 'error');
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (data: InviteFormData) => adminApi.sendInvite(data.email, data.name),
    onSuccess: () => {
      setInviteOpen(false);
      toast('Invite sent successfully', 'success');
      inviteForm.reset();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send invite';
      toast(msg, 'error');
    },
  });

  const createForm = useForm<CreateFormData>({ resolver: zodResolver(createSchema) });
  const inviteForm = useForm<InviteFormData>({ resolver: zodResolver(inviteSchema) });

  const users = data?.data.users || [];

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${users.length} client${users.length !== 1 ? 's' : ''}`}
        action={
          <div className="flex gap-2">
            <button onClick={() => setInviteOpen(true)} className="btn-secondary flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4" />
              Send Invite
            </button>
            <button onClick={() => setCreateOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" />
              Add Client
            </button>
          </div>
        }
      />

      {isLoading ? (
        <PageSpinner />
      ) : users.length === 0 ? (
        <div className="card text-center py-16">
          <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No clients yet</p>
          <button onClick={() => setCreateOpen(true)} className="btn-primary text-sm">Add First Client</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Website</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Joined</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/admin/users/${user.id}`} className="font-medium text-[#0D3040] hover:underline">
                      {user.name}
                    </Link>
                    <p className="text-xs text-gray-400">{user.email}</p>
                    {user.has_pending_invite && <span className="text-xs text-amber-600 font-medium">Invite pending</span>}
                    {user.has_pending_reset && <span className="text-xs text-orange-600 font-medium ml-1">Reset pending</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600">{user.company_name || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {user.website_url ? (
                      <a href={user.website_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[#1A5276] hover:underline text-xs">
                        <Globe className="w-3 h-3" />
                        {user.website_url.replace(/^https?:\/\//, '')}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3">
                    {user.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        <UserCheck className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        <UserX className="w-3 h-3" /> Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Client Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add New Client" size="lg">
        <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name <span className="text-red-500">*</span></label>
              <input type="text" className="input" {...createForm.register('name')} />
              {createForm.formState.errors.name && <p className="error-text">{createForm.formState.errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Email <span className="text-red-500">*</span></label>
              <input type="email" className="input" {...createForm.register('email')} />
              {createForm.formState.errors.email && <p className="error-text">{createForm.formState.errors.email.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="tel" className="input" {...createForm.register('phone')} />
            </div>
            <div>
              <label className="label">Company Name <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="text" className="input" {...createForm.register('company_name')} />
            </div>
          </div>
          <div>
            <label className="label">Website URL <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="url" className="input" placeholder="https://" {...createForm.register('website_url')} />
            {createForm.formState.errors.website_url && <p className="error-text">{createForm.formState.errors.website_url.message}</p>}
          </div>
          <div>
            <label className="label">Internal Notes <span className="text-gray-400 font-normal">(optional, not visible to client)</span></label>
            <textarea rows={2} className="input resize-none" {...createForm.register('client_notes')} />
          </div>
          <p className="text-xs text-gray-400">An invite email will be sent so the client can set their password.</p>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary text-sm flex items-center gap-2">
              {createMutation.isPending ? <Spinner className="w-3.5 h-3.5" /> : null}
              Create & Send Invite
            </button>
          </div>
        </form>
      </Modal>

      {/* Send Invite Modal */}
      <Modal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} title="Send Invite Link" size="sm">
        <form onSubmit={inviteForm.handleSubmit((d) => inviteMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Email Address <span className="text-red-500">*</span></label>
            <input type="email" className="input" {...inviteForm.register('email')} />
            {inviteForm.formState.errors.email && <p className="error-text">{inviteForm.formState.errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Name <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="text" className="input" {...inviteForm.register('name')} />
          </div>
          <p className="text-xs text-gray-400">The client will receive an email with a link to create their account. The link expires after 48 hours.</p>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setInviteOpen(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={inviteMutation.isPending} className="btn-primary text-sm flex items-center gap-2">
              {inviteMutation.isPending ? <Spinner className="w-3.5 h-3.5" /> : null}
              Send Invite
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
