import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminApi } from '../../api/admin';
import { ticketsApi } from '../../api/tickets';
import { PageHeader } from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import { PageSpinner } from '../../components/Spinner';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { formatDate } from '../../utils/formatters';
import { Globe, Mail, Phone, Building, FileText, KeyRound, Power, AlertCircle, Ticket } from 'lucide-react';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  company_name: z.string().optional(),
  website_url: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  client_notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);

  const { data: userData, isLoading } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => adminApi.getUser(Number(id)),
  });

  const { data: ticketsData } = useQuery({
    queryKey: ['admin-user-tickets', id],
    queryFn: () => ticketsApi.getAll({ client_id: Number(id) }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => adminApi.updateUser(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditMode(false);
      toast('Client details updated', 'success');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Update failed';
      toast(msg, 'error');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (is_active: boolean) => adminApi.updateUser(Number(id), { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast('Account status updated', 'success');
    },
    onError: () => toast('Failed to update account status', 'error'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => adminApi.sendPasswordReset(Number(id)),
    onSuccess: () => toast('Password reset email sent to client', 'success'),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send reset email';
      toast(msg, 'error');
    },
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (isLoading) return <PageSpinner />;
  if (!userData) return <div className="text-center py-16"><p className="text-gray-500">Client not found</p></div>;

  const { user, stats } = userData.data;
  const tickets = ticketsData?.data.tickets || [];

  function startEdit() {
    reset({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      company_name: user.company_name || '',
      website_url: user.website_url || '',
      client_notes: user.client_notes || '',
    });
    setEditMode(true);
  }

  return (
    <div>
      <PageHeader
        title={user.company_name || user.name}
        subtitle={user.email}
        breadcrumb={[{ label: 'Clients', to: '/admin/users' }, { label: user.name, to: `/admin/users/${user.id}` }]}
        action={
          <div className="flex gap-2">
            {!editMode && (
              <button onClick={startEdit} className="btn-secondary text-sm">Edit Details</button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Client details */}
        <div className="lg:col-span-2 space-y-5">
          {editMode ? (
            <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="card px-5 py-5 space-y-4">
              <h3 className="font-semibold text-[#0D3040] text-sm">Edit Client Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" className="input" {...register('name')} />
                  {errors.name && <p className="error-text">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="label">Email <span className="text-red-500">*</span></label>
                  <input type="email" className="input" {...register('email')} />
                  {errors.email && <p className="error-text">{errors.email.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Phone</label>
                  <input type="tel" className="input" {...register('phone')} />
                </div>
                <div>
                  <label className="label">Company Name</label>
                  <input type="text" className="input" {...register('company_name')} />
                </div>
              </div>
              <div>
                <label className="label">Website URL</label>
                <input type="url" className="input" {...register('website_url')} />
                {errors.website_url && <p className="error-text">{errors.website_url.message}</p>}
              </div>
              <div>
                <label className="label">Internal Notes <span className="text-gray-400 font-normal">(not visible to client)</span></label>
                <textarea rows={3} className="input resize-none" {...register('client_notes')} />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setEditMode(false)} className="btn-secondary text-sm">Cancel</button>
                <button type="submit" disabled={updateMutation.isPending} className="btn-primary text-sm flex items-center gap-2">
                  {updateMutation.isPending ? <Spinner className="w-3.5 h-3.5" /> : null}
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="card px-5 py-5">
              <h3 className="font-semibold text-[#0D3040] text-sm mb-4">Client Information</h3>
              <dl className="space-y-3">
                <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={user.email} />
                <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={user.phone || '—'} />
                <InfoRow icon={<Building className="w-4 h-4" />} label="Company" value={user.company_name || '—'} />
                <InfoRow
                  icon={<Globe className="w-4 h-4" />}
                  label="Website"
                  value={
                    user.website_url ? (
                      <a href={user.website_url} target="_blank" rel="noopener noreferrer"
                        className="text-[#1A5276] hover:underline">
                        {user.website_url}
                      </a>
                    ) : '—'
                  }
                />
                {user.client_notes && (
                  <InfoRow icon={<FileText className="w-4 h-4" />} label="Internal Notes" value={user.client_notes} />
                )}
              </dl>
            </div>
          )}

          {/* Tickets */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-[#0D3040] text-sm flex items-center gap-2">
                <Ticket className="w-4 h-4" />
                Tickets
              </h3>
            </div>
            {tickets.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No tickets</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <Link to={`/admin/tickets/${ticket.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                      <div>
                        <p className="text-sm font-medium text-[#0D3040]">#{ticket.id} — {ticket.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(ticket.created_at)}</p>
                      </div>
                      <StatusBadge status={ticket.status} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Stats */}
          <div className="card px-5 py-5">
            <h3 className="font-semibold text-[#0D3040] text-sm mb-4">Ticket Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Pending</span>
                <span className="font-medium text-amber-600">{stats.pending}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">In Progress</span>
                <span className="font-medium text-blue-600">{stats.in_progress}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Complete</span>
                <span className="font-medium text-green-600">{stats.complete}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-100 pt-2 mt-2">
                <span className="text-gray-500">Total</span>
                <span className="font-medium">{stats.total}</span>
              </div>
            </div>
          </div>

          {/* Account actions */}
          <div className="card px-5 py-5 space-y-3">
            <h3 className="font-semibold text-[#0D3040] text-sm border-b border-gray-100 pb-3">Account Actions</h3>

            <div>
              <p className="text-xs text-gray-500 mb-2">
                Status: <span className={user.is_active ? 'text-green-600 font-medium' : 'text-gray-400 font-medium'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </p>
              <button
                onClick={() => toggleActiveMutation.mutate(!user.is_active)}
                disabled={toggleActiveMutation.isPending}
                className={`w-full text-sm flex items-center justify-center gap-2 py-2 px-3 rounded-lg border font-medium transition-colors ${
                  user.is_active
                    ? 'border-red-200 text-red-600 hover:bg-red-50'
                    : 'border-green-200 text-green-600 hover:bg-green-50'
                }`}
              >
                {toggleActiveMutation.isPending ? <Spinner className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                {user.is_active ? 'Deactivate Account' : 'Activate Account'}
              </button>
            </div>

            <div>
              {user.has_pending_reset && (
                <div className="flex items-start gap-2 text-xs text-orange-600 bg-orange-50 rounded-lg p-2 mb-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>A password reset is currently pending for this client.</span>
                </div>
              )}
              <button
                onClick={() => resetPasswordMutation.mutate()}
                disabled={resetPasswordMutation.isPending}
                className="w-full text-sm flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-colors"
              >
                {resetPasswordMutation.isPending ? <Spinner className="w-3.5 h-3.5" /> : <KeyRound className="w-3.5 h-3.5" />}
                Send Password Reset Email
              </button>
            </div>

            <p className="text-xs text-gray-400 pt-1">Client since {formatDate(user.created_at)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-700">{value}</p>
      </div>
    </div>
  );
}
