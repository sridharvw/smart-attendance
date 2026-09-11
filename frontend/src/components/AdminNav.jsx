import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { setAdminToken } from '../api';

export default function AdminNav({ onLogout }) {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('adminToken');
    setAdminToken(null);
    onLogout?.();
    navigate('/admin');
  };

  return (
    <nav className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <a href="/admin" className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100">Live dashboard</a>
        <a href="/admin/events" className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100">Meetings</a>
        <a href="/admin/directory" className="rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100">Directory</a>
      </div>
      <button type="button" onClick={logout} title="Sign out" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-red-50 hover:text-red-700">
        <LogOut size={16} /> Sign out
      </button>
    </nav>
  );
}
