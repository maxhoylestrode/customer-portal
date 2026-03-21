import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../api/auth';
import Spinner from '../../components/Spinner';
import { CheckCircle } from 'lucide-react';

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      await authApi.resetPasswordConfirm(token!, data.password);
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to reset password';
      setError('root', { message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#D6EAF8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#0D3040] rounded-t-xl px-8 py-6 text-center">
          <h1 className="text-white font-bold text-xl">Apex Studio Codes</h1>
          <p className="text-blue-200 text-sm mt-1">Client Portal</p>
        </div>
        <div className="bg-white rounded-b-xl shadow-xl px-8 py-8">
          {success ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-[#0D3040] mb-2">Password Reset</h2>
              <p className="text-gray-500 text-sm mb-4">Your password has been updated. Redirecting to login…</p>
              <Link to="/login" className="btn-primary inline-block">Go to Login</Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-[#0D3040] mb-6">Set a new password</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="label">New Password</label>
                  <input type="password" className="input" autoComplete="new-password" {...register('password')} />
                  {errors.password && <p className="error-text">{errors.password.message}</p>}
                </div>
                <div>
                  <label className="label">Confirm New Password</label>
                  <input type="password" className="input" autoComplete="new-password" {...register('confirmPassword')} />
                  {errors.confirmPassword && <p className="error-text">{errors.confirmPassword.message}</p>}
                </div>
                {errors.root && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                    {errors.root.message}
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
                  {loading ? <Spinner className="w-4 h-4" /> : null}
                  {loading ? 'Saving…' : 'Set New Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
