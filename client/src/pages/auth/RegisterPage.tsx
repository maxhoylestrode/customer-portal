import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import Spinner from '../../components/Spinner';

const schema = z.object({
  name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  phone: z.string().optional(),
  company_name: z.string().optional(),
  website_url: z.string().url('Enter a valid URL').optional().or(z.literal('')),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const invite = searchParams.get('invite');
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [invalidInvite, setInvalidInvite] = useState(!invite);

  const { register, handleSubmit, formState: { errors }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (invalidInvite || !invite) {
    return (
      <div className="min-h-screen bg-[#D6EAF8] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl px-8 py-8 max-w-md w-full text-center">
          <h2 className="text-lg font-semibold text-[#0D3040] mb-3">Invalid Invitation</h2>
          <p className="text-gray-500 text-sm mb-6">
            This registration link is invalid or has expired. Please contact Apex Studio Codes to receive a new invite.
          </p>
          <Link to="/login" className="btn-primary inline-block">Back to Login</Link>
        </div>
      </div>
    );
  }

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await authApi.register({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        company_name: data.company_name,
        website_url: data.website_url,
        invite: invite!,
      });
      setUser(res.data.user);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Registration failed';
      if (msg.toLowerCase().includes('invite')) {
        setInvalidInvite(true);
      }
      setError('root', { message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#D6EAF8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#0D3040] rounded-t-xl px-8 py-6 text-center">
          <img src="/logo.png" alt="Apex Studio Codes" className="h-12 mx-auto mb-3" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <h1 className="text-white font-bold text-xl">Apex Studio Codes</h1>
          <p className="text-blue-200 text-sm mt-1">Create your portal account</p>
        </div>

        <div className="bg-white rounded-b-xl shadow-xl px-8 py-8">
          <h2 className="text-lg font-semibold text-[#0D3040] mb-6">Set up your account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Full Name <span className="text-red-500">*</span></label>
              <input type="text" className="input" autoComplete="name" {...register('name')} />
              {errors.name && <p className="error-text">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Email Address <span className="text-red-500">*</span></label>
              <input type="email" className="input" autoComplete="email" {...register('email')} />
              {errors.email && <p className="error-text">{errors.email.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Password <span className="text-red-500">*</span></label>
                <input type="password" className="input" autoComplete="new-password" {...register('password')} />
                {errors.password && <p className="error-text">{errors.password.message}</p>}
              </div>
              <div>
                <label className="label">Confirm Password <span className="text-red-500">*</span></label>
                <input type="password" className="input" autoComplete="new-password" {...register('confirmPassword')} />
                {errors.confirmPassword && <p className="error-text">{errors.confirmPassword.message}</p>}
              </div>
            </div>
            <div>
              <label className="label">Phone Number <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="tel" className="input" autoComplete="tel" {...register('phone')} />
            </div>
            <div>
              <label className="label">Business / Trading Name <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="text" className="input" {...register('company_name')} />
            </div>
            <div>
              <label className="label">Website URL <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="url" className="input" placeholder="https://yourwebsite.co.uk" {...register('website_url')} />
              {errors.website_url && <p className="error-text">{errors.website_url.message}</p>}
            </div>

            {errors.root && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {errors.root.message}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
              {loading ? <Spinner className="w-4 h-4" /> : null}
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
