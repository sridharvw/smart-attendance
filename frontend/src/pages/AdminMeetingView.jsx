import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import { useParams } from 'react-router-dom';
import { Plus, X, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export default function AdminMeetingView() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  
  const [newStudent, setNewStudent] = useState({
    name: '',
    regNumber: '',
    course: 'BCA',
    section: ''
  });

  useEffect(() => {
    loadMeeting();
    const interval = setInterval(loadMeeting, 3000);
    return () => clearInterval(interval);
  }, [eventId]);

  const loadMeeting = async () => {
    try {
      const eventRes = await axios.get(`${API_BASE_URL}/events/${eventId}/public`);
      setEvent(eventRes.data);
      
      const attendanceRes = await axios.get(`${API_BASE_URL}/attendance/live/${eventId}`);
      setAttendances(attendanceRes.data);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load meeting');
      setLoading(false);
    }
  };

  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.regNumber) {
      alert('Please enter name and register number');
      return;
    }

    setAdding(true);
    try {
      await axios.post(`${API_BASE_URL}/attendance/mark`, {
        name: newStudent.name,
        regNumber: newStudent.regNumber,
        course: newStudent.course,
        section: newStudent.section,
        code: '9999', // Admin manual entry code
        event_id: eventId,
        latitude: event.location.latitude,
        longitude: event.location.longitude,
        accuracy: 0,
        device_id: `ADMIN-${Date.now()}`,
        manually_added: true
      });
      
      setNewStudent({ name: '', regNumber: '', course: 'BCA', section: '' });
      setShowAddForm(false);
      await loadMeeting();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add student');
    } finally {
      setAdding(false);
    }
  };

  const handleStatusUpdate = async (attendanceId, newStatus) => {
    try {
      await axios.patch(`${API_BASE_URL}/attendance/${attendanceId}/status`, {
        status: newStatus,
        override_reason: `Admin action: ${newStatus}`
      });
      await loadMeeting();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handleDelete = async (attendanceId) => {
    if (window.confirm('Delete this attendance record?')) {
      try {
        await axios.delete(`${API_BASE_URL}/attendance/${attendanceId}`);
        await loadMeeting();
      } catch (err) {
        alert('Failed to delete');
      }
    }
  };

  if (loading) return <div className="p-10 text-center">Loading meeting...</div>;
  if (!event) return <div className="p-10 text-center text-red-600">Meeting not found</div>;

  const presentCount = attendances.filter(a => a.status === 'present').length;
  const reviewCount = attendances.filter(a => a.status === 'needs_review').length;
  const rejectedCount = attendances.filter(a => a.status === 'rejected').length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
              <p className="text-gray-500 mt-1">{event.venue} • {event.location.radius}m radius</p>
            </div>
            <a href="/admin/events" className="text-blue-600 hover:underline">← Back to meetings</a>
          </div>
        </div>

        {error && <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="text-gray-500 text-sm font-medium">Total</div>
            <div className="text-3xl font-bold text-gray-900">{attendances.length}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-green-100 bg-green-50">
            <div className="text-green-700 text-sm font-medium">✓ Present</div>
            <div className="text-3xl font-bold text-green-600">{presentCount}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-yellow-100 bg-yellow-50">
            <div className="text-yellow-700 text-sm font-medium">⚠️ Review</div>
            <div className="text-3xl font-bold text-yellow-600">{reviewCount}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 bg-red-50">
            <div className="text-red-700 text-sm font-medium">✗ Absent</div>
            <div className="text-3xl font-bold text-red-600">{rejectedCount}</div>
          </div>
        </div>

        {/* Add Student Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
          >
            <Plus size={20} /> Add Student Manually
          </button>
        </div>

        {/* Add Student Form */}
        {showAddForm && (
          <div className="mb-6 p-6 bg-white rounded-xl border border-blue-200 shadow-sm">
            <h3 className="text-lg font-bold mb-4">Add Student to {event.name}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input
                placeholder="Full Name"
                value={newStudent.name}
                onChange={e => setNewStudent({...newStudent, name: e.target.value})}
                className="p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                placeholder="Register Number"
                value={newStudent.regNumber}
                onChange={e => setNewStudent({...newStudent, regNumber: e.target.value.toUpperCase()})}
                className="p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                placeholder="Course"
                value={newStudent.course}
                onChange={e => setNewStudent({...newStudent, course: e.target.value})}
                className="p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                placeholder="Semester/Section"
                value={newStudent.section}
                onChange={e => setNewStudent({...newStudent, section: e.target.value})}
                className="p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddStudent}
                disabled={adding}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-60"
              >
                {adding ? 'Adding...' : 'Mark Present & Add'}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Attendance List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 font-semibold text-gray-700">
            Live Attendance
          </div>
          
          <div className="divide-y divide-gray-100">
            {attendances.map(record => (
              <div key={record._id} className="p-4 px-6 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <div className="font-bold text-gray-900">{record.user_id?.name || 'Unknown'}</div>
                  <div className="text-sm text-gray-500">{record.user_id?.register_number}</div>
                  <div className="text-xs text-gray-400">{record.location.distance_from_venue}m away</div>
                </div>

                <div className="flex items-center gap-2">
                  {record.status === 'present' && <CheckCircle2 size={20} className="text-green-600" />}
                  {record.status === 'needs_review' && <AlertTriangle size={20} className="text-yellow-600" />}
                  {record.status === 'rejected' && <XCircle size={20} className="text-red-600" />}
                  
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    record.status === 'present' ? 'bg-green-100 text-green-700' :
                    record.status === 'needs_review' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {record.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex gap-1 ml-4">
                  {record.status !== 'present' && (
                    <button
                      onClick={() => handleStatusUpdate(record._id, 'present')}
                      className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-700"
                    >
                      ✓
                    </button>
                  )}
                  {record.status !== 'rejected' && (
                    <button
                      onClick={() => handleStatusUpdate(record._id, 'rejected')}
                      className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-700"
                    >
                      ✗
                    </button>
                  )}
                  {record.status !== 'needs_review' && (
                    <button
                      onClick={() => handleStatusUpdate(record._id, 'needs_review')}
                      className="bg-yellow-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-yellow-700"
                    >
                      ⚠️
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(record._id)}
                    className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
            {attendances.length === 0 && (
              <div className="p-6 text-center text-gray-500">No attendance records yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
