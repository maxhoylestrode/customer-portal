import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';
import { defaultRouteForRole } from '../../router';

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
      navigate(defaultRouteForRole(res.data.user.role), { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Login failed';
      setError('root', { message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo card */}
        <div className="bg-white border border-line border-b-0 rounded-t-xl px-8 pt-8 pb-2 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-700"><img src="/logo.png" alt="Apex Studio Codes" className="h-8 w-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /></div>
          <h1 className="text-gray-900 font-semibold text-xl tracking-tight">Apex Studio Codes</h1>
          <p className="text-gray-500 text-sm mt-1">Client Portal</p>
        </div>

        <div className="bg-white border border-line border-t-0 rounded-b-xl px-8 pt-6 pb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input type="email" className="input" autoComplete="email" autoCapitalize="none" {...register('email')} />
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

          <p className="text-center text-sm mt-6">
            <Link to="/forgot-password" className="text-brand-500 font-medium hover:underline">Forgotten your password?</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
