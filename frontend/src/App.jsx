import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VolunteerCheckIn from './pages/VolunteerCheckIn';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminEvents from './pages/AdminEvents';
import AdminDirectory from './pages/AdminDirectory';
import { setAdminToken } from './api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const isJwt = token && token.split('.').length === 3;
    if (isJwt) {
      setAdminToken(token);
      setIsAuthenticated(true);
    } else if (token) {
      localStorage.removeItem('adminToken');
      setAdminToken(null);
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<VolunteerCheckIn />} />
        <Route path="/meeting/:eventId" element={<VolunteerCheckIn />} />
        
        {/* Protected Admin Route */}
        <Route path="/admin" element={
          isAuthenticated ? (
            <AdminDashboard onLogout={() => setIsAuthenticated(false)} />
          ) : (
            <AdminLogin onLogin={() => setIsAuthenticated(true)} />
          )
        } />
        <Route path="/admin/events" element={
          isAuthenticated ? <AdminEvents onLogout={() => setIsAuthenticated(false)} /> : <AdminLogin onLogin={() => setIsAuthenticated(true)} />
        } />
        <Route path="/admin/directory" element={
          isAuthenticated ? <AdminDirectory onLogout={() => setIsAuthenticated(false)} /> : <AdminLogin onLogin={() => setIsAuthenticated(true)} />
        } />
      </Routes>
    </Router>
  );
}

export default App;