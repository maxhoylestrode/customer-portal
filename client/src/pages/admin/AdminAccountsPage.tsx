import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminApi } from '../../api/admin';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/Layout';
import { PageSpinner } from '../../components/Spinner';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { formatDate } from '../../utils/formatters';
import { Plus, ShieldCheck } from 'lucide-react';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(1, 'Please confirm the password'),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});
type FormData = z.infer<typeof schema>;

export default function AdminAccountsPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-admins'],
    queryFn: () => adminApi.listAdmins(),
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createMutation = useMutation({
    mutationFn: (d: FormData) => adminApi.createAdmin({ name: d.name, email: d.email, password: d.password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-admins'] });
      setShowModal(false);
      reset();
      toast('Admin account created', 'success');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create admin';
      toast(msg, 'error');
    },
  });

  if (isLoading) return <PageSpinner />;

  const admins = data?.data.admins || [];

  return (
    <div>
      <PageHeader
        title="Admin Accounts"
        subtitle="Manage administrator accounts for this portal."
        action={
          <button onClick={() => { reset(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Admin
          </button>
        }
      />

      <div className="card">
        {admins.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No admin accounts found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#1A5276] shrink-0" />
                      <span className="font-medium text-[#0D3040]">{admin.name}</span>
                      {admin.id === currentUser?.id && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">You</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{admin.email}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${admin.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {admin.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(admin.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={showModal} title="Create Admin Account" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="label">Full Name <span className="text-red-500">*</span></label>
              <input type="text" className="input" {...register('name')} />
              {errors.name && <p className="error-text">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Email Address <span className="text-red-500">*</span></label>
              <input type="email" className="input" {...register('email')} />
              {errors.email && <p className="error-text">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Password <span className="text-red-500">*</span></label>
              <input type="password" className="input" autoComplete="new-password" {...register('password')} />
              {errors.password && <p className="error-text">{errors.password.message}</p>}
            </div>
            <div>
              <label className="label">Confirm Password <span className="text-red-500">*</span></label>
              <input type="password" className="input" autoComplete="new-password" {...register('confirm_password')} />
              {errors.confirm_password && <p className="error-text">{errors.confirm_password.message}</p>}
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-sm">Cancel</button>
              <button type="submit" disabled={createMutation.isPending} className="btn-primary text-sm flex items-center gap-2">
                {createMutation.isPending && <Spinner className="w-3.5 h-3.5" />}
                Create Admin
              </button>
            </div>
          </form>
      </Modal>
    </div>
  );
}
