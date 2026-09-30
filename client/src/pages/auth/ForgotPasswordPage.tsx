import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../api/auth';
import Spinner from '../../components/Spinner';
import { MailCheck } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      await authApi.forgotPassword(data.email);
      setSentTo(data.email);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Something went wrong, please try again';
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
          {sentTo ? (
            <div className="text-center">
              <MailCheck className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-[#0D3040] mb-2">Check your email</h2>
              <p className="text-gray-500 text-sm mb-2">
                If <span className="font-medium text-gray-700">{sentTo}</span> has an account, we've sent it a link to reset your password.
              </p>
              <p className="text-gray-500 text-sm mb-6">The link works for 1 hour. Check your spam folder if it hasn't arrived in a few minutes.</p>
              <Link to="/login" className="btn-primary inline-block">Back to sign in</Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-[#0D3040] mb-2">Forgotten your password?</h2>
              <p className="text-gray-500 text-sm mb-6">Enter the email you sign in with and we'll send you a link to set a new one.</p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <input type="email" className="input" autoComplete="email" autoCapitalize="none" autoFocus {...register('email')} />
                  {errors.email && <p className="error-text">{errors.email.message}</p>}
                </div>
                {errors.root && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                    {errors.root.message}
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
                  {loading ? <Spinner className="w-4 h-4" /> : null}
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <p className="text-center text-sm mt-6">
                <Link to="/login" className="text-[#0D3040] font-medium hover:underline">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
