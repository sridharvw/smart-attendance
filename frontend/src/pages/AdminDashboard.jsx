import { useState, useEffect } from 'react';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';
import { API_BASE_URL } from '../api';
import AdminNav from '../components/AdminNav';
import { Copy, Download } from 'lucide-react';

export default function AdminDashboard({ onLogout }) {
  const [event, setEvent] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [codeData, setCodeData] = useState({ code: '----', expires_in: 300 });
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    initialLoad();

    // Refresh attendance feed every 5 seconds
    const attendanceInterval = setInterval(fetchDashboardData, 5000);
    
    // Refresh countdown every 1 second
    const codeInterval = setInterval(() => {
      setCodeData((prev) => {
        if (prev.expires_in <= 1) {
          fetchCode(event?._id);
          return { ...prev, expires_in: 300 };
        }
        return { ...prev, expires_in: prev.expires_in - 1 };
      });
    }, 1000);

    return () => {
      clearInterval(attendanceInterval);
      clearInterval(codeInterval);
    };
  }, [event?._id]);

  const initialLoad = async () => {
    await fetchDashboardData();
  };

  const fetchDashboardData = async () => {
    try {
      const eventRes = await axios.get(`${API_BASE_URL}/events/active`);
      const activeEvent = eventRes.data;
      setEvent(activeEvent);

      const attendanceRes = await axios.get(`${API_BASE_URL}/attendance/live/${activeEvent._id}`);
      setAttendances(attendanceRes.data);
      
      fetchCode(activeEvent._id);
      setLoading(false);
    } catch (error) {
      if (error.response?.status === 404) {
        setEvent(null);
        setAttendances([]);
        setCodeData({ code: '----', expires_in: 300 });
      } else {
        console.error('Error fetching dashboard data', error);
      }
      setLoading(false);
    }
  };

  const fetchCode = async (eventId) => {
    try {
      if (!eventId) return;
      const res = await axios.get(`${API_BASE_URL}/events/${eventId}/code`);
      if (res.data && res.data.code) {
        setCodeData(res.data);
      }
    } catch (error) {
      console.error('Error fetching code', error);
    }
  };

  const handleStatusUpdate = async (attendanceId, newStatus) => {
  const reason = window.prompt(`Please enter a reason to ${newStatus === 'present' ? 'ACCEPT' : 'REJECT'} this check-in:`);
  
  // If the admin clicks Cancel or leaves it blank, stop the update
  if (!reason || reason.trim() === '') {
    alert('Action cancelled: A reason is required to override attendance.');
    return;
  }

  setReviewingId(attendanceId);
  setActionError('');
  try {
    await axios.patch(`${API_BASE_URL}/attendance/${attendanceId}/status`, {
      status: newStatus,
      override_reason: reason.trim() // Send the reason to the backend
    });
    setAttendances(previous => previous.map(record => record._id === attendanceId
      ? { ...record, status: newStatus, override_reason: reason.trim() }
      : record));
  } catch (error) {
    console.error('Failed to update status', error);
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin';
      return;
    }
    setActionError(error.response?.data?.message || 'Could not update attendance status');
  } finally {
    setReviewingId(null);
  }
};

  const handleExportCSV = () => {
    if (!event) return;
    axios.get(`${API_BASE_URL}/attendance/export/${event._id}`, { responseType: 'blob' })
      .then(response => {
        const url = URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = `attendance-report-${event._id}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch(error => setActionError(error.response?.status === 401 ? 'Your admin session expired. Please sign in again.' : 'Could not download the CSV report'));
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Loading Dashboard...</div>;
  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-4xl">
          <AdminNav onLogout={onLogout} />
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">No active meeting</h1>
            <p className="mt-2 text-gray-500">Create a new meeting to open attendance and generate its link and QR code.</p>
            <a href="/admin/events" className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700">Create new meeting</a>
          </div>
        </div>
      </div>
    );
  }

  const meetingLink = `${window.location.origin}/meeting/${event._id}`;

  const presentCount = attendances.filter(a => a.status === 'present').length;
  const reviewCount = attendances.filter(a => a.status === 'needs_review').length;

  const handleCloseEvent = async () => {
  const confirmClose = window.confirm("Are you sure you want to close this event? No more attendance will be accepted.");
  if (!confirmClose) return;

  try {
    await axios.patch(`${API_BASE_URL}/events/${event._id}/close`);
    setEvent(null); // Clears the dashboard view
    alert("Event closed successfully. Please download your final CSV.");
  } catch (error) {
    console.error('Failed to close event', error);
    alert('Could not close event');
  }
};
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <AdminNav onLogout={onLogout} />
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <p className="text-gray-500">Live Attendance Dashboard</p>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={handleExportCSV}
              className="bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-black transition"
            >
              Download CSV Report
            </button>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
              ATTENDANCE OPEN
            </div>
          </div>
        </div>

        {/* Rotating Code Card */}
        <div className="bg-blue-600 text-white rounded-xl shadow-sm p-6 mb-6 flex justify-between items-center">
          <div>
            <div className="text-blue-100 text-sm uppercase tracking-wider font-semibold">Current Rotating Code</div>
            <div className="text-5xl font-mono font-extrabold tracking-widest mt-2">{codeData.code}</div>
          </div>
          <div className="text-right bg-blue-700/50 p-4 rounded-xl border border-blue-500/30">
            <div className="text-xs text-blue-200">Changes in</div>
            <div className="text-2xl font-bold font-mono">{codeData.expires_in}s</div>
          </div>
        </div>

        {actionError && <div className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</div>}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Admin tools</h2>
            <p className="mt-1 text-sm text-gray-500">Manage sessions and review cumulative NSS attendance.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="/admin/events" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Manage meetings</a>
              <a href="/admin/directory" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Student directory</a>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <QRCodeCanvas value={meetingLink} size={132} includeMargin />
            <p className="mt-2 text-xs font-semibold text-gray-600">Scan to check in</p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Current meeting link</p><p className="mt-1 break-all text-sm text-blue-950">{meetingLink}</p></div>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigator.clipboard.writeText(meetingLink)} title="Copy meeting link" className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-100"><Copy size={16} /> Copy</button>
              <button type="button" onClick={handleExportCSV} title="Download attendance CSV" className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-100"><Download size={16} /> CSV</button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm font-medium">Total Scans</div>
            <div className="text-3xl font-bold text-gray-900">{attendances.length}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm font-medium">Verified Present</div>
            <div className="text-3xl font-bold text-green-600">{presentCount}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 bg-red-50">
            <div className="text-red-600 text-sm font-medium">⚠️ Needs Review</div>
            <div className="text-3xl font-bold text-red-600">{reviewCount}</div>
          </div>
        </div>

        {/* Live Feed Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 font-semibold text-gray-700">
            Recent Check-ins
          </div>
          <div className="divide-y divide-gray-100">
            {attendances.map((record) => (
              <div key={record._id} className="p-4 px-6 flex items-center justify-between hover:bg-gray-50 transition">
                <div>
                  <div className="font-bold text-gray-900">{record.user_id?.name || 'Unknown'}</div>
                  <div className="text-sm text-gray-500">{record.user_id?.register_number || 'N/A'}</div>
                  <div className="text-xs text-gray-400 mt-1">{record.location.distance_from_venue}m away</div>
                  <div className="text-xs text-gray-400">Device: {record.device_id || 'Not recorded'}</div>
                </div>
                <div className="flex items-center space-x-3">
                  <button 
                  onClick={handleExportCSV}
                  className="bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-black transition"
                  >
                    Download CSV
                    </button>
                    <button 
                    onClick={handleCloseEvent}
                    className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-700 transition"
                    >
                      End Session
                      </button>
                      </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    {record.status === 'present' && (
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Present</span>
                    )}
                    {record.status === 'needs_review' && (
                      <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Needs Review</span>
                    )}
                    {record.status === 'rejected' && (
                      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Rejected</span>
                    )}
                  </div>

                  {record.status === 'needs_review' && (
                    <div className="flex space-x-1">
                      <button 
                        disabled={reviewingId === record._id}
                        onClick={() => handleStatusUpdate(record._id, 'present')}
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-700 transition"
                      >
                        {reviewingId === record._id ? 'Saving...' : 'Accept'}
                      </button>
                      <button 
                        disabled={reviewingId === record._id}
                        onClick={() => handleStatusUpdate(record._id, 'rejected')}
                        className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-700 transition"
                      >
                        {reviewingId === record._id ? 'Saving...' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {attendances.length === 0 && (
              <div className="p-6 text-center text-gray-500">No one has checked in yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}