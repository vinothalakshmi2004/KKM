import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { changePassword } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import DataStorageCard from '../../components/DataStorageCard';
import SidebarSettingsCard from '../../components/SidebarSettingsCard';

export default function Settings() {
  const { user, login } = useAuth();
  const { dark, toggle } = useTheme();
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const pwdMutation = useMutation({
    mutationFn: () => changePassword({ currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword }),
    onSuccess: (res) => {
      // Older tokens are revoked by the server; keep this session with the new one
      const { token, user: updated } = res.data?.data || {};
      if (token) login(token, updated || user);
      toast.success('Password changed. Other devices have been logged out.');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to change password'),
  });

  const handlePwdSubmit = (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (pwdForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    pwdMutation.mutate();
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-6">
      <h1 className="page-title">Settings</h1>

      {/* Profile info */}
      <div className="card">
        <h3 className="section-title mb-4">Account</h3>
        <div className="space-y-2 text-sm text-ink-600 dark:text-ink-300">
          <div className="flex items-center gap-2">
            <span className="text-ink-400 w-20">Name</span>
            <span className="font-medium text-ink-900 dark:text-white">{user?.name || 'Admin'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-ink-400 w-20">Email</span>
            <span className="font-medium text-ink-900 dark:text-white">{user?.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-ink-400 w-20">Role</span>
            <span className="badge badge-blue">{user?.role || 'admin'}</span>
          </div>
        </div>
      </div>

      {/* Theme */}
      <div className="card">
        <h3 className="section-title mb-4">Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-ink-900 dark:text-white">Dark Mode</p>
            <p className="text-sm text-ink-500 dark:text-ink-400">Toggle between light and dark theme</p>
          </div>
          <button
            onClick={toggle}
            className={`relative inline-flex h-7 items-center rounded-full transition-colors ${dark ? 'bg-brand-600' : 'bg-ink-200 dark:bg-ink-600'}`}
            style={{ width: '52px' }}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${dark ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* GST default */}
      <div className="card">
        <h3 className="section-title mb-4">Default GST</h3>
        <p className="text-sm text-ink-600 dark:text-ink-300">
          GST is set per hotel and pre-filled on that hotel's new bookings. Change it under{' '}
          <Link to="/admin/hotels" className="text-brand-600 hover:underline">Hotels → Edit</Link>.
        </p>
      </div>

      {/* Change password */}
      <div className="card">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-500" /> Change Password
        </h3>
        <form onSubmit={handlePwdSubmit} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                className="input pr-10"
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                required
              />
              <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">
                {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                className="input pr-10"
                value={pwdForm.newPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                required
                minLength={8}
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input
              type="password"
              className="input"
              value={pwdForm.confirmPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
              required
            />
          </div>
          <button
            type="submit"
            disabled={pwdMutation.isPending || !pwdForm.currentPassword || !pwdForm.newPassword}
            className="btn-primary"
          >
            {pwdMutation.isPending ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Changing…</>
            ) : 'Change Password'}
          </button>
        </form>
      </div>

      <SidebarSettingsCard />

      <DataStorageCard />
    </div>
  );
}
