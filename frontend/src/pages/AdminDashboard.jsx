import { useState, useEffect } from 'react';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';
import { API_BASE_URL } from '../api';
import AdminNav from '../components/AdminNav';
import { Check, Copy, Download, X } from 'lucide-react';

export default function AdminDashboard({ onLogout, isDarkMode, onToggleDarkMode }) {
  const [event, setEvent] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [codeData, setCodeData] = useState({ code: '------', token: '', expires_in: 0 });
  const [codeError, setCodeError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [selectedReviewIds, setSelectedReviewIds] = useState([]);
  const [bulkActionStatus, setBulkActionStatus] = useState(null);
  const [sortBy, setSortBy] = useState('recent');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    initialLoad();

    // Refresh attendance feed every 3 seconds
    const attendanceInterval = setInterval(fetchDashboardData, 3000);
    
    // Refresh countdown every 1 second
    const codeInterval = setInterval(() => {
      setCodeData((prev) => {
        if (!prev.token || !/^\d{6}$/.test(prev.code)) return prev;
        if (prev.expires_in <= 1) {
          fetchCode(event?._id);
          return { code: '------', token: '', expires_in: 0 };
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
          setCodeData({ code: '------', token: '', expires_in: 0 });
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
      if (!/^\d{6}$/.test(res.data?.code || '') || !/^[a-f0-9]{64}$/i.test(res.data?.token || '') || !Number.isFinite(res.data?.expires_in)) {
        setCodeData({ code: '------', token: '', expires_in: 0 });
        setCodeError('The backend is not returning the latest QR and six-digit code. Redeploy the backend, then refresh this page.');
        return;
      }
      setCodeData(res.data);
      setCodeError('');
    } catch (requestError) {
      setCodeData({ code: '------', token: '', expires_in: 0 });
      const status = requestError.response?.status;
      setCodeError(status === 401
        ? 'Admin session expired. Sign out and sign in again to load the live QR and code.'
        : status === 404 || status >= 500
          ? 'The backend could not generate credentials. Deploy the latest backend, then refresh this page.'
          : requestError.response?.data?.message || 'Could not load the live QR and code. Check the backend connection, then refresh.');
    }
  };

  const handleStatusUpdate = async (attendanceId, newStatus) => {
  const reason = window.prompt(`Reason to mark this check-in ${newStatus === 'present' ? 'present' : 'absent'}:`);
  
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
    setSelectedReviewIds(previous => previous.filter(id => id !== attendanceId));
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

  const handleBulkAction = async (newStatus) => {
    if (reviewingId || bulkActionStatus) return;

    const selectedIds = attendances
      .filter(record => record.status === 'needs_review' && selectedReviewIds.includes(record._id))
      .map(record => record._id);
    if (!selectedIds.length) return;

    const actionLabel = newStatus === 'present' ? 'mark present' : 'mark absent';
    const reason = window.prompt(`Reason to ${actionLabel} ${selectedIds.length} selected check-ins:`);
    if (!reason?.trim()) return;

    setBulkActionStatus(newStatus);
    setActionError('');
    try {
      const results = await Promise.allSettled(selectedIds.map(attendanceId => (
        axios.patch(`${API_BASE_URL}/attendance/${attendanceId}/status`, {
          status: newStatus,
          override_reason: reason.trim()
        })
      )));
      const successfulIds = selectedIds.filter((_, index) => results[index].status === 'fulfilled');
      const failedResults = results.filter(result => result.status === 'rejected');

      setAttendances(previous => previous.map(record => successfulIds.includes(record._id)
        ? { ...record, status: newStatus, override_reason: reason.trim() }
        : record));
      setSelectedReviewIds(previous => previous.filter(id => !successfulIds.includes(id)));

      if (failedResults.some(result => result.reason?.response?.status === 401)) {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin';
        return;
      }

      if (failedResults.length) {
        setActionError(`${successfulIds.length} updated; ${failedResults.length} failed and remain selected for retry.`);
      }
    } finally {
      setBulkActionStatus(null);
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
          <AdminNav onLogout={onLogout} isDarkMode={isDarkMode} onToggleDarkMode={onToggleDarkMode} />
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">No active meeting</h1>
            <p className="mt-2 text-gray-500">Create a new meeting to open attendance and generate its link and QR code.</p>
            <a href="/admin/events" className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700">Create new meeting</a>
          </div>
        </div>
      </div>
    );
  }

  const meetingLink = `${window.location.origin}${import.meta.env.BASE_URL}meeting/${event._id}`;

  const presentCount = attendances.filter(a => a.status === 'present').length;
  const reviewCount = attendances.filter(a => a.status === 'needs_review').length;
  const absentCount = attendances.filter(a => a.status === 'absent').length;
  const reviewIds = attendances.filter(a => a.status === 'needs_review').map(a => a._id);
  const selectedReviewCount = reviewIds.filter(id => selectedReviewIds.includes(id)).length;
  const allReviewsSelected = reviewIds.length > 0 && selectedReviewCount === reviewIds.length;
  const deviceUseCounts = new Map();
  attendances.forEach(record => {
    if (record.device_id) {
      deviceUseCounts.set(record.device_id, (deviceUseCounts.get(record.device_id) || 0) + 1);
    }
  });
  const calculateRiskScore = (record) => {
    const distance = record.location?.distance_from_venue;
    const accuracy = record.location?.accuracy;
    const radius = event.location?.radius;
    let score = record.status === 'needs_review' ? 100 : 0;

    if (record.device_id && deviceUseCounts.get(record.device_id) > 1) score += 50;
    if (Number.isFinite(distance) && Number.isFinite(radius) && distance > radius) {
      score += 50;
    } else if (Number.isFinite(distance) && Number.isFinite(accuracy) && Number.isFinite(radius) && distance + accuracy > radius) {
      score += 30;
    }

    return score;
  };
  const mostRecentFirst = (first, second) => new Date(second.createdAt) - new Date(first.createdAt);
  const sortedAttendances = [...attendances].sort((first, second) => {
    if (sortBy === 'risky') {
      return calculateRiskScore(second) - calculateRiskScore(first) || mostRecentFirst(first, second);
    }
    if (sortBy === 'distance') {
      const distanceDifference = (second.location?.distance_from_venue ?? -Infinity) - (first.location?.distance_from_venue ?? -Infinity);
      return distanceDifference || mostRecentFirst(first, second);
    }
    if (sortBy === 'accuracy') {
      const accuracyDifference = (second.location?.accuracy ?? -Infinity) - (first.location?.accuracy ?? -Infinity);
      return accuracyDifference || mostRecentFirst(first, second);
    }
    return mostRecentFirst(first, second);
  });
  const getReviewReasons = (record) => {
    const distance = record.location?.distance_from_venue;
    const accuracy = record.location?.accuracy;
    const radius = event.location?.radius;
    const reasons = [];

    if (Number.isFinite(distance) && Number.isFinite(radius) && distance > radius) {
      reasons.push(`${Math.round(distance - radius)}m outside the venue radius`);
    } else if (Number.isFinite(distance) && Number.isFinite(accuracy) && Number.isFinite(radius) && distance + accuracy > radius) {
      reasons.push(`GPS uncertainty reaches beyond the venue radius (${Math.round(accuracy)}m accuracy)`);
    }

    const deviceReused = record.device_id && attendances.some(candidate => (
      candidate._id !== record._id &&
      candidate.device_id === record.device_id &&
      String(candidate.user_id?._id || candidate.user_id) !== String(record.user_id?._id || record.user_id)
    ));
    if (deviceReused) reasons.push('Same device used for another volunteer');

    return reasons.length ? reasons : ['Flagged for admin review'];
  };

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
        <AdminNav onLogout={onLogout} isDarkMode={isDarkMode} onToggleDarkMode={onToggleDarkMode} />
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

        <div className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Live check-in QR</h2>
            <p className="mt-1 max-w-xl text-sm text-gray-600">Volunteers can scan this QR in the form or enter its six-digit code. Both refresh every 30 seconds; check-in is limited to the meeting geofence.</p>
            {codeError
              ? <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{codeError}</p>
              : <p className="mt-3 text-sm font-semibold text-blue-700">Refreshes in {codeData.expires_in}s</p>}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            {codeData.token && <QRCodeCanvas value={`${meetingLink}?token=${encodeURIComponent(codeData.token)}`} size={180} includeMargin />}
            <p className="mt-2 text-xs font-semibold text-gray-600">Or enter this code in the check-in form</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-[0.25em] text-gray-900">{/^\d{6}$/.test(codeData.code) ? codeData.code : '------'}</p>
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
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
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
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm font-medium">Marked Absent</div>
            <div className="text-3xl font-bold text-red-700">{absentCount}</div>
          </div>
        </div>

        {/* Live Feed Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 px-6 py-3 border-b border-gray-100 font-semibold text-gray-700">
            Recent Check-ins
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <span>Sort</span>
              <select
                value={sortBy}
                onChange={event => setSortBy(event.target.value)}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                aria-label="Sort attendance records"
              >
                <option value="recent">Recent First</option>
                <option value="risky">Most Risky First</option>
                <option value="distance">Farthest Away First</option>
                <option value="accuracy">Worst GPS First</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-white px-6 py-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={allReviewsSelected}
                disabled={reviewIds.length === 0 || Boolean(reviewingId) || Boolean(bulkActionStatus)}
                onChange={() => setSelectedReviewIds(previous => (
                  allReviewsSelected
                    ? previous.filter(id => !reviewIds.includes(id))
                    : [...new Set([...previous, ...reviewIds])]
                ))}
                className="h-4 w-4 accent-blue-600"
                aria-label="Select all check-ins needing review"
              />
              Select all {reviewCount} needing review
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {selectedReviewCount > 0 && <span className="mr-1 text-sm text-gray-600">{selectedReviewCount} selected</span>}
              <button
                type="button"
                onClick={() => handleBulkAction('present')}
                disabled={selectedReviewCount === 0 || Boolean(reviewingId) || Boolean(bulkActionStatus)}
                className="flex items-center gap-2 rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check size={16} /> {bulkActionStatus === 'present' ? 'Accepting…' : 'Accept selected'}
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction('absent')}
                disabled={selectedReviewCount === 0 || Boolean(reviewingId) || Boolean(bulkActionStatus)}
                className="flex items-center gap-2 rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={16} /> {bulkActionStatus === 'absent' ? 'Saving…' : 'Mark absent'}
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {sortedAttendances.map((record) => (
              <div key={record._id} className="p-4 px-6 flex items-center justify-between hover:bg-gray-50 transition">
                <div className="flex min-w-0 items-start gap-3">
                  {record.status === 'needs_review' && (
                    <input
                      type="checkbox"
                      checked={selectedReviewIds.includes(record._id)}
                      disabled={Boolean(reviewingId) || Boolean(bulkActionStatus)}
                      onChange={() => setSelectedReviewIds(previous => (
                        previous.includes(record._id)
                          ? previous.filter(id => id !== record._id)
                          : [...previous, record._id]
                      ))}
                      className="mt-1 h-4 w-4 accent-blue-600"
                      aria-label={`Select ${record.user_id?.name || 'volunteer'} for review action`}
                    />
                  )}
                  <div>
                    <div className="font-bold text-gray-900">{record.user_id?.name || 'Unknown'}</div>
                    <div className="text-sm text-gray-500">{record.user_id?.register_number || 'N/A'}</div>
                    <div className="text-xs text-gray-400 mt-1">{record.location?.distance_from_venue ?? 'Unknown'}m away</div>
                    <div className="text-xs text-gray-400">Device: {record.device_id || 'Not recorded'}</div>
                    {record.status === 'needs_review' && (
                      <div className="mt-2 space-y-1 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                        {getReviewReasons(record).map(reason => <p key={reason}>{reason}</p>)}
                      </div>
                    )}
                  </div>
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
                    {record.status === 'absent' && (
                      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Absent</span>
                    )}
                    {record.status === 'rejected' && (
                      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Rejected</span>
                    )}
                  </div>

                  {record.status === 'needs_review' && (
                    <div className="flex space-x-1">
                      <button 
                        disabled={reviewingId === record._id || Boolean(bulkActionStatus)}
                        onClick={() => handleStatusUpdate(record._id, 'present')}
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-700 transition"
                      >
                        {reviewingId === record._id ? 'Saving...' : 'Present'}
                      </button>
                      <button 
                        disabled={reviewingId === record._id || Boolean(bulkActionStatus)}
                        onClick={() => handleStatusUpdate(record._id, 'absent')}
                        className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-700 transition"
                      >
                        {reviewingId === record._id ? 'Saving...' : 'Absent'}
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