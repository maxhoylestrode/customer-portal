import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await authApi.login(data.email, data.password);
      setUser(res.data.user);
      navigate(res.data.user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Login failed';
      setError('root', { message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#D6EAF8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo card */}
        <div className="bg-[#0D3040] rounded-t-xl px-8 py-6 text-center">
          <img src="/logo.png" alt="Apex Studio Codes" className="h-12 mx-auto mb-3" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <h1 className="text-white font-bold text-xl">Apex Studio Codes</h1>
          <p className="text-blue-200 text-sm mt-1">Client Portal</p>
        </div>

        <div className="bg-white rounded-b-xl shadow-xl px-8 py-8">
          <h2 className="text-lg font-semibold text-[#0D3040] mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input type="email" className="input" autoComplete="email" {...register('email')} />
              {errors.email && <p className="error-text">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <input type="password" className="input" autoComplete="current-password" {...register('password')} />
              {errors.password && <p className="error-text">{errors.password.message}</p>}
            </div>

            {errors.root && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {errors.root.message}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
              {loading ? <Spinner className="w-4 h-4" /> : null}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Forgotten your password? Contact <span className="text-[#0D3040] font-medium">Apex Studio Codes</span> to reset it.
          </p>
        </div>
      </div>
    </div>
  );
}
