import { Eye, EyeOff, KeyRound, LogOut, Moon, Sun, X } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, setAdminToken } from '../api';

export default function AdminNav({ onLogout, isDarkMode, onToggleDarkMode }) {
  const navigate = useNavigate();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const logout = () => {
    localStorage.removeItem('adminToken');
    setAdminToken(null);
    onLogout?.();
    navigate('/admin');
  };

  const changePassword = async event => {
    event.preventDefault();
    setPasswordError('');
    if (passwords.newPassword.length < 10) {
      setPasswordError('New password must be at least 10 characters long.');
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await axios.post(`${API_BASE_URL}/admin/change-password`, {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });
      localStorage.removeItem('adminToken');
      setAdminToken(null);
      onLogout?.();
      navigate('/admin', { state: { passwordChanged: true } });
    } catch (requestError) {
      setPasswordError(requestError.response?.data?.message || 'Could not change password. Check the server connection.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <nav className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <a href="/admin" className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100">Live dashboard</a>
        <a href="/admin/events" className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100">Meetings</a>
        <a href="/admin/directory" className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100">Directory</a>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => { setPasswordError(''); setShowPasswordDialog(true); }} title="Change admin password" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
          <KeyRound size={16} /> Change password
        </button>
        <button type="button" onClick={onToggleDarkMode} title={isDarkMode ? 'Use light theme' : 'Use dark theme'} aria-label={isDarkMode ? 'Use light theme' : 'Use dark theme'} className="rounded-md p-2 text-gray-600 hover:bg-gray-100">
          {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button type="button" onClick={logout} title="Sign out" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-red-50 hover:text-red-700">
          <LogOut size={16} /> Sign out
        </button>
      </div>
      {showPasswordDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
          <form onSubmit={changePassword} className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 id="change-password-title" className="flex items-center gap-2 text-lg font-bold text-gray-900"><KeyRound size={18} /> Change admin password</h2>
              <button type="button" onClick={() => setShowPasswordDialog(false)} title="Close password dialog" aria-label="Close password dialog" className="rounded-md p-2 text-gray-500 hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input type={showPasswords ? 'text' : 'password'} value={passwords.currentPassword} onChange={event => setPasswords(value => ({ ...value, currentPassword: event.target.value }))} placeholder="Current password" aria-label="Current password" autoComplete="current-password" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <input type={showPasswords ? 'text' : 'password'} value={passwords.newPassword} onChange={event => setPasswords(value => ({ ...value, newPassword: event.target.value }))} placeholder="New password (at least 10 characters)" aria-label="New password" autoComplete="new-password" minLength={10} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <input type={showPasswords ? 'text' : 'password'} value={passwords.confirmPassword} onChange={event => setPasswords(value => ({ ...value, confirmPassword: event.target.value }))} placeholder="Confirm new password" aria-label="Confirm new password" autoComplete="new-password" minLength={10} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <button type="button" onClick={() => setShowPasswords(value => !value)} className="mt-3 flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900">
              {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />} {showPasswords ? 'Hide passwords' : 'Show passwords'}
            </button>
            {passwordError && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{passwordError}</p>}
            <button type="submit" disabled={savingPassword} className="mt-5 w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{savingPassword ? 'Updating...' : 'Change password'}</button>
          </form>
        </div>
      )}
    </nav>
  );
}
