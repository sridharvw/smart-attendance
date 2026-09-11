import { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL, setAdminToken } from '../api';

export default function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE_URL}/admin/login`, { password });
      if (res.data.success) {
        localStorage.setItem('adminToken', res.data.token);
        setAdminToken(res.data.token);
        onLogin();
      }
    } catch (requestError) {
      setError(requestError.response?.status === 401 ? 'Incorrect password' : 'Could not connect to the server');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white max-w-sm w-full rounded-2xl shadow-xl overflow-hidden p-8">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">Admin Access</h1>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-center">{error}</div>}
        
        <form onSubmit={handleLogin}>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter Admin Password" 
            className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            required 
          />
          <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black transition">
            Access Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}