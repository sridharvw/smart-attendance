import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, CalendarPlus, Check, CheckCircle2, Copy, Crosshair, Download, Search, UserPlus, X, XCircle, Users, MapPin, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../api';
import AdminNav from '../components/AdminNav';

const getInitialForm = () => {
  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const time = value => value.toTimeString().slice(0, 5);

  return {
    name: '',
    venue: '',
    date,
    openTime: time(now),
    closeTime: time(later),
    latitude: '13.0489',
    longitude: '77.5922',
    radius: '150',
    openNow: true
  };
};

export default function AdminEvents({ onLogout, isDarkMode, onToggleDarkMode }) {
  const [form, setForm] = useState(getInitialForm);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [createdEvent, setCreatedEvent] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedAttendance, setSelectedAttendance] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendeeQuery, setAttendeeQuery] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('all');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState(null);
  const [manualStudent, setManualStudent] = useState({ name: '', regNumber: '', course: '', section: '', status: 'present' });
  const meetingUrl = eventId => `${window.location.origin}${import.meta.env.BASE_URL}meeting/${eventId}`;

  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);
  const mapReady = Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  const mapDelta = 0.002;
  const mapUrl = mapReady
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - mapDelta}%2C${latitude - mapDelta}%2C${longitude + mapDelta}%2C${latitude + mapDelta}&layer=mapnik&marker=${latitude}%2C${longitude}`
    : '';

  const loadEvents = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/events`);
      setEvents(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load meetings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleChange = event => {
    const { name, value, type, checked } = event.target;
    setForm(previous => ({ ...previous, [name]: type === 'checkbox' ? checked : value }));
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('This browser does not support location access');
      return;
    }

    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      position => {
        setForm(previous => ({
          ...previous,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6)
        }));
        setLocationAccuracy(Math.round(position.coords.accuracy));
        setLocating(false);
      },
      () => {
        setError('Location permission was denied or unavailable');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const viewAttendance = async event => {
    setSelectedEvent(event);
    setSelectedAttendance([]);
    setAttendanceLoading(true);
    setAttendanceError('');
    setAttendeeQuery('');
    setAttendanceFilter('all');

    try {
      const response = await axios.get(`${API_BASE_URL}/attendance/live/${event._id}`);
      setSelectedAttendance(response.data);
    } catch (requestError) {
      setAttendanceError(requestError.response?.data?.message || 'Could not load attendance records');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const addManualStudent = async event => {
    event.preventDefault();
    setAddingStudent(true);
    setAttendanceError('');
    try {
      const response = await axios.post(`${API_BASE_URL}/attendance/manual`, {
        ...manualStudent,
        event_id: selectedEvent._id
      });
      setSelectedAttendance(previous => [response.data, ...previous.filter(record => record._id !== response.data._id)]);
      setManualStudent({ name: '', regNumber: '', course: '', section: '', status: 'present' });
      setShowAddStudent(false);
    } catch (requestError) {
      setAttendanceError(requestError.response?.data?.message || 'Could not add this student to the meeting');
    } finally {
      setAddingStudent(false);
    }
  };

  const updateMeetingAttendance = async (record, status) => {
    setStatusSavingId(record._id);
    setAttendanceError('');
    try {
      const response = await axios.patch(`${API_BASE_URL}/attendance/${record._id}/status`, {
        status,
        override_reason: `Marked ${status} by admin`
      });
      setSelectedAttendance(previous => previous.map(item => item._id === record._id ? response.data.updated : item));
    } catch (requestError) {
      setAttendanceError(requestError.response?.data?.message || 'Could not update attendance');
    } finally {
      setStatusSavingId(null);
    }
  };

  const downloadAttendance = eventId => {
    axios.get(`${API_BASE_URL}/attendance/export/${eventId}`, { responseType: 'blob' })
      .then(response => {
        const url = URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = `attendance-report-${eventId}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setAttendanceError('Could not download the attendance report'));
  };

  const filteredAttendance = selectedAttendance.filter(record => {
    const matchesFilter = attendanceFilter === 'all' || record.status === attendanceFilter;
    const searchText = `${record.user_id?.name || ''} ${record.user_id?.register_number || ''} ${record.user_id?.course || ''}`.toLowerCase();
    return matchesFilter && searchText.includes(attendeeQuery.toLowerCase());
  });

  const handleSubmit = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const openDateTime = new Date(`${form.date}T${form.openTime}`);
      const closeDateTime = new Date(`${form.date}T${form.closeTime}`);
      const eventDate = new Date(`${form.date}T00:00:00`);

      if ([eventDate, openDateTime, closeDateTime].some(value => Number.isNaN(value.getTime()))) {
        throw new Error('Please enter a valid meeting date and time');
      }

      if (closeDateTime <= openDateTime) {
        closeDateTime.setDate(closeDateTime.getDate() + 1);
      }

      const response = await axios.post(`${API_BASE_URL}/events`, {
        name: form.name,
        venue: form.venue,
        date: eventDate.toISOString(),
        open_time: openDateTime.toISOString(),
        close_time: closeDateTime.toISOString(),
        latitude: form.latitude,
        longitude: form.longitude,
        radius: form.radius,
        open_now: form.openNow
      });
      setForm(getInitialForm());
      setCreatedEvent(response.data);
      setMessage('Meeting created successfully.');
      await loadEvents();
    } catch (requestError) {
      const serverMessage = requestError.response?.data?.message;
      const connectionMessage = !requestError.response
        ? `Could not reach the attendance server at ${API_BASE_URL}. Start the backend and try again.`
        : '';
      setError(serverMessage || connectionMessage || requestError.message || 'Could not create meeting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav onLogout={onLogout} isDarkMode={isDarkMode} onToggleDarkMode={onToggleDarkMode} />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Event Manager</p>
            <h1 className="text-3xl font-bold text-gray-900">Meetings</h1>
            <p className="mt-1 text-gray-500">Create the next attendance window and manage past sessions.</p>
          </div>
          <a href="/admin" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">Live dashboard</a>
        </div>

        {(error || message) && (
          <div className={`mb-5 rounded-lg p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {error || message}
          </div>
        )}

        {createdEvent && (
          <div className="mb-6 flex flex-wrap items-center gap-5 rounded-xl border border-green-200 bg-green-50 p-5">
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-green-900">Meeting link ready</h2>
              <p className="mt-1 text-sm text-green-800">Volunteers can scan the meeting QR once on the dashboard when they arrive.</p>
              <div className="mt-3 flex max-w-xl items-center gap-2 rounded-lg border border-green-200 bg-white p-2">
                <input readOnly value={meetingUrl(createdEvent._id)} className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 outline-none" />
                <button type="button" title="Copy meeting link" onClick={() => navigator.clipboard.writeText(meetingUrl(createdEvent._id))} className="rounded-md p-2 text-green-700 hover:bg-green-50"><Copy size={16} /></button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 text-blue-700"><CalendarPlus size={20} /></div>
              <div>
                <h2 className="font-bold text-gray-900">Create New Meeting</h2>
                <p className="text-xs text-gray-500">Only one meeting can be open at a time.</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">Meeting name
                <input name="name" value={form.name} onChange={handleChange} required className="mt-1 w-full rounded-lg border border-gray-300 p-3" placeholder="NSS Weekly Meeting" />
              </label>
              <label className="block text-sm font-medium text-gray-700">Venue
                <input name="venue" value={form.venue} onChange={handleChange} required className="mt-1 w-full rounded-lg border border-gray-300 p-3" placeholder="Presidency College" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-gray-700">Date
                  <input type="date" name="date" value={form.date} onChange={handleChange} required className="mt-1 w-full rounded-lg border border-gray-300 p-3" />
                </label>
                <label className="block text-sm font-medium text-gray-700">Radius (m)
                  <input type="number" min="1" name="radius" value={form.radius} onChange={handleChange} required className="mt-1 w-full rounded-lg border border-gray-300 p-3" />
                </label>
              </div>
              <button type="button" onClick={useCurrentLocation} disabled={locating} className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-60">
                <Crosshair size={17} /> {locating ? 'Finding location...' : 'Use my current location'}
              </button>
              {locationAccuracy !== null && <p className="text-xs text-gray-500">GPS accuracy: approximately {locationAccuracy}m. Use a clear outdoor location for better results.</p>}
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-gray-700">Opens
                  <input type="time" name="openTime" value={form.openTime} onChange={handleChange} required className="mt-1 w-full rounded-lg border border-gray-300 p-3" />
                </label>
                <label className="block text-sm font-medium text-gray-700">Closes
                  <input type="time" name="closeTime" value={form.closeTime} onChange={handleChange} required className="mt-1 w-full rounded-lg border border-gray-300 p-3" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-gray-700">Latitude
                  <input type="number" step="any" name="latitude" value={form.latitude} onChange={handleChange} required className="mt-1 w-full rounded-lg border border-gray-300 p-3" />
                </label>
                <label className="block text-sm font-medium text-gray-700">Longitude
                  <input type="number" step="any" name="longitude" value={form.longitude} onChange={handleChange} required className="mt-1 w-full rounded-lg border border-gray-300 p-3" />
                </label>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                {mapReady ? (
                  <iframe
                    title="Meeting location map"
                    src={mapUrl}
                    className="h-56 w-full border-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center p-4 text-center text-sm text-gray-500">Enter valid coordinates to preview the meeting location.</div>
                )}
              </div>
              {mapReady && <a href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`} target="_blank" rel="noreferrer" className="-mt-2 block text-right text-xs font-semibold text-blue-700 hover:underline">Open larger map</a>}
              <label className="flex items-center gap-3 rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-900">
                <input type="checkbox" name="openNow" checked={form.openNow} onChange={handleChange} className="h-4 w-4" />
                Open attendance immediately
              </label>
              <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                <CalendarPlus size={18} /> {saving ? 'Creating...' : 'Create Meeting'}
              </button>
            </div>
          </form>

          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <div>
                <h2 className="font-bold text-gray-900">All Meetings</h2>
                <p className="text-sm text-gray-500">Your complete session history.</p>
              </div>
              <button onClick={loadEvents} title="Refresh meetings" className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"><RefreshCw size={18} /></button>
            </div>
            {loading ? <p className="p-6 text-gray-500">Loading meetings...</p> : (
              <div className="divide-y divide-gray-100">
                {events.map(event => (
                  <div key={event._id} className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:bg-gray-50">
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-gray-900">
                        {event.name}
                        <span className={`rounded-full px-2 py-1 text-xs font-bold uppercase ${event.status === 'open' ? 'bg-green-100 text-green-700' : event.status === 'upcoming' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{event.status}</span>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-sm text-gray-500"><MapPin size={14} /> {event.venue}</p>
                      <p className="mt-1 text-xs text-gray-400">{new Date(event.open_time).toLocaleString()} - {new Date(event.close_time).toLocaleTimeString()}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-sm text-gray-500">{new Date(event.date).toLocaleDateString()}</p>
                      <button type="button" onClick={() => viewAttendance(event)} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
                        <Users size={16} /> View attendance
                      </button>
                    </div>
                  </div>
                ))}
                {!events.length && <p className="p-6 text-gray-500">No meetings created yet.</p>}
              </div>
            )}
          </section>
        </div>
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="attendance-dialog-title">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 p-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="attendance-dialog-title" className="text-xl font-bold text-gray-900">{selectedEvent.name}</h2>
                  <span className={`rounded-full px-2 py-1 text-xs font-bold uppercase ${selectedEvent.status === 'closed' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>{selectedEvent.status}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{selectedEvent.venue} · {new Date(selectedEvent.date).toLocaleDateString()}</p>
              </div>
              <button type="button" onClick={() => setSelectedEvent(null)} title="Close attendance details" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"><X size={20} /></button>
            </div>

            <div className="overflow-y-auto p-6">
              {attendanceError && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{attendanceError}</div>}
              {attendanceLoading ? <p className="py-12 text-center text-gray-500">Loading attendance records...</p> : (
                <>
                  <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border border-gray-200 p-4"><p className="text-xs font-semibold uppercase text-gray-500">Meeting records</p><p className="mt-1 text-2xl font-bold text-gray-900">{selectedAttendance.length}</p></div>
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4"><p className="text-xs font-semibold uppercase text-green-700">Present</p><p className="mt-1 text-2xl font-bold text-green-700">{selectedAttendance.filter(record => record.status === 'present').length}</p></div>
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4"><p className="text-xs font-semibold uppercase text-yellow-700">Review</p><p className="mt-1 text-2xl font-bold text-yellow-700">{selectedAttendance.filter(record => record.status === 'needs_review').length}</p></div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4"><p className="text-xs font-semibold uppercase text-red-700">Absent</p><p className="mt-1 text-2xl font-bold text-red-700">{selectedAttendance.filter(record => record.status === 'absent').length}</p></div>
                  </div>

                  <div className="mb-4">
                    <button type="button" onClick={() => setShowAddStudent(value => !value)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                      <UserPlus size={16} /> {showAddStudent ? 'Cancel add student' : 'Add student'}
                    </button>
                    {showAddStudent && (
                      <form onSubmit={addManualStudent} className="mt-3 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
                        <input aria-label="Student name" value={manualStudent.name} onChange={event => setManualStudent(previous => ({ ...previous, name: event.target.value }))} placeholder="Full name" required className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />
                        <input aria-label="Register number" value={manualStudent.regNumber} onChange={event => setManualStudent(previous => ({ ...previous, regNumber: event.target.value }))} placeholder="Register number" required className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />
                        <input aria-label="Course" value={manualStudent.course} onChange={event => setManualStudent(previous => ({ ...previous, course: event.target.value }))} placeholder="Course" required className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />
                        <input aria-label="Semester or section" value={manualStudent.section} onChange={event => setManualStudent(previous => ({ ...previous, section: event.target.value }))} placeholder="Semester / section" required className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />
                        <select aria-label="Initial attendance status" value={manualStudent.status} onChange={event => setManualStudent(previous => ({ ...previous, status: event.target.value }))} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                        </select>
                        <button type="submit" disabled={addingStudent} className="flex items-center justify-center gap-2 rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">
                          <Check size={16} /> {addingStudent ? 'Saving...' : 'Add to this meeting'}
                        </button>
                      </form>
                    )}
                  </div>

                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <label className="relative min-w-[220px] flex-1">
                      <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input value={attendeeQuery} onChange={event => setAttendeeQuery(event.target.value)} placeholder="Search name, register number, or course" className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm" />
                    </label>
                    <div className="flex items-center gap-2">
                      <select value={attendanceFilter} onChange={event => setAttendanceFilter(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">
                        <option value="all">All statuses</option>
                        <option value="present">Present</option>
                        <option value="needs_review">Needs review</option>
                        <option value="absent">Absent</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <button type="button" onClick={() => downloadAttendance(selectedEvent._id)} title="Download attendance CSV" className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-900"><Download size={16} /> CSV</button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr] gap-3 bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 sm:grid">
                      <span>Volunteer</span><span>Course</span><span>Check-in</span><span>Status</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {filteredAttendance.map(record => (
                        <div key={record._id} className="grid gap-2 px-4 py-4 sm:grid-cols-[1.5fr_1fr_1fr_1fr] sm:items-center sm:gap-3">
                          <div><p className="font-semibold text-gray-900">{record.user_id?.name || 'Unknown volunteer'}</p><p className="text-sm text-gray-500">{record.user_id?.register_number || 'No register number'}</p></div>
                          <p className="text-sm text-gray-600">{record.user_id?.course || 'Not recorded'} <span className="text-gray-400">· {record.user_id?.semester || 'N/A'}</span></p>
                          <p className="text-sm text-gray-600">{new Date(record.createdAt).toLocaleString()}</p>
                          <div className="space-y-2">
                            <span className={`flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs font-bold uppercase ${record.status === 'present' ? 'bg-green-100 text-green-700' : record.status === 'needs_review' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {record.status === 'present' ? <CheckCircle2 size={13} /> : record.status === 'needs_review' ? <AlertTriangle size={13} /> : <XCircle size={13} />}
                              {record.status.replace('_', ' ')}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              <button type="button" disabled={statusSavingId === record._id || record.status === 'present'} onClick={() => updateMeetingAttendance(record, 'present')} className="rounded bg-green-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40">Present</button>
                              <button type="button" disabled={statusSavingId === record._id || record.status === 'absent'} onClick={() => updateMeetingAttendance(record, 'absent')} className="rounded bg-red-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40">Absent</button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {!filteredAttendance.length && <p className="p-8 text-center text-sm text-gray-500">No attendance records match this filter.</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
