import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/Layout';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { User, KeyRound } from 'lucide-react';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email required'),
});
type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'New password must be at least 8 characters'),
  confirm_password: z.string().min(1, 'Please confirm your new password'),
}).refine((d) => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});
type PasswordForm = z.infer<typeof passwordSchema>;

export default function AdminProfilePage() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [profileEditMode, setProfileEditMode] = useState(false);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileForm) => authApi.updateProfile(data),
    onSuccess: (res) => {
      if (user) setUser({ ...user, ...res.data.user });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setProfileEditMode(false);
      toast('Profile updated successfully', 'success');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Update failed';
      toast(msg, 'error');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: PasswordForm) => authApi.changePassword(data.current_password, data.new_password),
    onSuccess: () => {
      passwordForm.reset();
      toast('Password changed successfully', 'success');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Password change failed';
      toast(msg, 'error');
    },
  });

  function startEdit() {
    profileForm.reset({ name: user?.name || '', email: user?.email || '' });
    setProfileEditMode(true);
  }

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Manage your admin account details and password." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Profile info */}
          {profileEditMode ? (
            <form
              onSubmit={profileForm.handleSubmit((d) => updateProfileMutation.mutate(d))}
              className="card px-5 py-5 space-y-4"
            >
              <h2 className="font-semibold text-[#0D3040] text-sm flex items-center gap-2">
                <User className="w-4 h-4" />
                Edit Profile
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" className="input" {...profileForm.register('name')} />
                  {profileForm.formState.errors.name && (
                    <p className="error-text">{profileForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <label className="label">Email <span className="text-red-500">*</span></label>
                  <input type="email" className="input" {...profileForm.register('email')} />
                  {profileForm.formState.errors.email && (
                    <p className="error-text">{profileForm.formState.errors.email.message}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setProfileEditMode(false)} className="btn-secondary text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={updateProfileMutation.isPending} className="btn-primary text-sm flex items-center gap-2">
                  {updateProfileMutation.isPending && <Spinner className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="card px-5 py-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-[#0D3040] text-sm flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Account Details
                </h2>
                <button onClick={startEdit} className="btn-secondary text-sm">Edit</button>
              </div>
              <dl className="space-y-3">
                <InfoRow label="Full Name" value={user?.name || '—'} />
                <InfoRow label="Email" value={user?.email || '—'} />
                <InfoRow label="Role" value="Administrator" />
              </dl>
            </div>
          )}

          {/* Change password */}
          <form
            onSubmit={passwordForm.handleSubmit((d) => changePasswordMutation.mutate(d))}
            className="card px-5 py-5 space-y-4"
          >
            <h2 className="font-semibold text-[#0D3040] text-sm flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              Change Password
            </h2>
            <div>
              <label className="label">Current Password</label>
              <input type="password" className="input" autoComplete="current-password" {...passwordForm.register('current_password')} />
              {passwordForm.formState.errors.current_password && (
                <p className="error-text">{passwordForm.formState.errors.current_password.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">New Password</label>
                <input type="password" className="input" autoComplete="new-password" {...passwordForm.register('new_password')} />
                {passwordForm.formState.errors.new_password && (
                  <p className="error-text">{passwordForm.formState.errors.new_password.message}</p>
                )}
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input type="password" className="input" autoComplete="new-password" {...passwordForm.register('confirm_password')} />
                {passwordForm.formState.errors.confirm_password && (
                  <p className="error-text">{passwordForm.formState.errors.confirm_password.message}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={changePasswordMutation.isPending} className="btn-primary text-sm flex items-center gap-2">
                {changePasswordMutation.isPending && <Spinner className="w-3.5 h-3.5" />}
                Update Password
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar */}
        <div>
          <div className="card px-5 py-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#0D3040] flex items-center justify-center text-white text-xl font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-[#0D3040]">{user?.name}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">Administrator</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
      <dt className="text-xs text-gray-400 sm:w-32 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-700">{value}</dd>
    </div>
  );
}
