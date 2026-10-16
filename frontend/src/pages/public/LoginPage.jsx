import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { login as loginApi } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL } from '../../utils/apiUrl';
import BrandLogo from '../../components/BrandLogo';
import GoldNerves from '../../components/GoldNerves';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const [showPwd, setShowPwd] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data) => loginApi(data),
    onSuccess: (res) => {
      const { token, user, data } = res.data;
      const userData = user || data?.user || data;
      const authToken = token || data?.token;
      if (!authToken) {
        toast.error('Login failed: no token returned by server');
        return;
      }
      // Don't carry over the previous user's hotel selection
      localStorage.removeItem('selectedHotelId');
      login(authToken, userData);
      toast.success('Logged in successfully!');
      navigate('/admin');
    },
    onError: (err) => {
      // No response at all = server down, wrong API URL, or blocked by CORS — not a bad password
      const msg = err.response
        ? err.response.data?.message || 'Invalid email or password'
        : `Cannot reach the server at ${API_URL}. Check that the backend is running.`;
      toast.error(msg);
    },
  });

  return (
    <div className="dark-surface relative min-h-screen flex items-center justify-center bg-gradient-to-br from-night via-night-800 to-night p-4 overflow-hidden">
      {/* Animated gold "nerves" behind the form */}
      <GoldNerves className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(var(--night)/0.55)_0%,transparent_60%)] pointer-events-none" aria-hidden="true" />
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <BrandLogo full className="w-28 h-28 mx-auto rounded-2xl shadow-xl shadow-brand-900/50 mb-4 block" />
          <h1 className="text-2xl font-bold text-white">KKM Hotels</h1>
          <p className="text-ink-400 text-sm mt-1">Sign in to admin portal</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-ink-200 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  type="email"
                  {...register('email')}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-ink-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                  placeholder="admin@example.com"
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p className="flex items-center gap-1 text-xs text-red-400 mt-1">
                  <AlertCircle className="w-3 h-3" />{errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-ink-200 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  {...register('password')}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-ink-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="flex items-center gap-1 text-xs text-red-400 mt-1">
                  <AlertCircle className="w-3 h-3" />{errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 mt-2"
            >
              {mutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-ink-500 text-sm mt-6">
          <a href="/" className="hover:text-ink-300 transition-colors">← Back to public site</a>
        </p>
      </div>
    </div>
  );
}
