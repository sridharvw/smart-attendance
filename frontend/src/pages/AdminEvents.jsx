import { useEffect, useState } from 'react';
import axios from 'axios';
import { CalendarPlus, Copy, Crosshair, MapPin, RefreshCw } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { API_BASE_URL } from '../api';
import AdminNav from '../components/AdminNav';

const getInitialForm = () => {
  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  const date = now.toISOString().slice(0, 10);
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

export default function AdminEvents({ onLogout }) {
  const [form, setForm] = useState(getInitialForm);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [createdEvent, setCreatedEvent] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState(null);

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

  const handleSubmit = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.post(`${API_BASE_URL}/events`, {
        name: form.name,
        venue: form.venue,
        date: new Date(`${form.date}T${form.openTime}`).toISOString(),
        open_time: new Date(`${form.date}T${form.openTime}`).toISOString(),
        close_time: new Date(`${form.date}T${form.closeTime}`).toISOString(),
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
      setError(requestError.response?.data?.message || 'Could not create meeting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav onLogout={onLogout} />
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
            <QRCodeCanvas value={`${window.location.origin}/meeting/${createdEvent._id}`} size={132} includeMargin />
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-green-900">Meeting link ready</h2>
              <p className="mt-1 text-sm text-green-800">Share this link or QR code. It opens this meeting directly.</p>
              <div className="mt-3 flex max-w-xl items-center gap-2 rounded-lg border border-green-200 bg-white p-2">
                <input readOnly value={`${window.location.origin}/meeting/${createdEvent._id}`} className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 outline-none" />
                <button type="button" title="Copy meeting link" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/meeting/${createdEvent._id}`)} className="rounded-md p-2 text-green-700 hover:bg-green-50"><Copy size={16} /></button>
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
                  <div key={event._id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-gray-900">
                        {event.name}
                        <span className={`rounded-full px-2 py-1 text-xs font-bold uppercase ${event.status === 'open' ? 'bg-green-100 text-green-700' : event.status === 'upcoming' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{event.status}</span>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-sm text-gray-500"><MapPin size={14} /> {event.venue}</p>
                    </div>
                    <p className="text-sm text-gray-500">{new Date(event.date).toLocaleDateString()}</p>
                  </div>
                ))}
                {!events.length && <p className="p-6 text-gray-500">No meetings created yet.</p>}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
