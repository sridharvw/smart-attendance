import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import { useParams } from 'react-router-dom';

const calculateDistance = (latitude1, longitude1, latitude2, longitude2) => {
  const radians = Math.PI / 180;
  const latitudeDelta = (latitude2 - latitude1) * radians;
  const longitudeDelta = (longitude2 - longitude1) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1 * radians) * Math.cos(latitude2 * radians) *
    Math.sin(longitudeDelta / 2) ** 2;

  return Math.round(6371e3 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
};

export default function VolunteerCheckIn() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [watchingLocation, setWatchingLocation] = useState(false);
  const locationWatch = useRef(null);
  
  const [formData, setFormData] = useState({
    name: '',
    regNumber: '',
    course: 'BCA',
    section: '',
    code: ''
  });

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const response = await axios.get(eventId
          ? `${API_BASE_URL}/events/${eventId}/public`
          : `${API_BASE_URL}/events/active`);
        setEvent(response.data);
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'This meeting link is unavailable');
      }
    };

    loadEvent();
  }, [eventId]);

  useEffect(() => () => {
    if (locationWatch.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatch.current);
    }
  }, []);

  const stopLocationTracking = () => {
    if (locationWatch.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatch.current);
      locationWatch.current = null;
    }
    setWatchingLocation(false);
  };

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setLocationError('');
    setWatchingLocation(true);
    locationWatch.current = navigator.geolocation.watchPosition(
      ({ coords }) => setLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy
      }),
      () => {
        setLocationError('Location access failed. Allow GPS access and try again.');
        stopLocationTracking();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError('');

    if (!location) {
      setError('Check your location before marking attendance.');
      return;
    }

    setLoading(true);
    try {
      const activeEvent = event || (await axios.get(`${API_BASE_URL}/events/active`)).data;
      const selectedEventId = activeEvent._id;

      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = 'DVC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        localStorage.setItem('device_id', deviceId);
      }

      const submitRes = await axios.post(`${API_BASE_URL}/attendance/mark`, {
        name: formData.name,
        regNumber: formData.regNumber,
        course: formData.course,
        section: formData.section,
        code: formData.code,
        event_id: selectedEventId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        device_id: deviceId
      });

      setResult(submitRes.data);
      setStep(2);
      stopLocationTracking();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit attendance');
    } finally {
      setLoading(false);
    }
  };

  const distanceToVenue = location && event?.location
    ? calculateDistance(event.location.latitude, event.location.longitude, location.latitude, location.longitude)
    : null;
  const withinReliableRadius = distanceToVenue !== null &&
    distanceToVenue + location.accuracy <= event.location.radius;
  const accuracyStyle = !location
    ? 'border-gray-200 bg-gray-50 text-gray-700'
    : location.accuracy < 50
      ? 'border-green-200 bg-green-50 text-green-800'
      : location.accuracy < 100
        ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
        : 'border-red-200 bg-red-50 text-red-800';

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 p-6 text-center text-white">
          <h1 className="text-2xl font-bold">{event?.name || 'NSS Attendance'}</h1>
          <p className="text-blue-100 mt-1">{event?.venue || 'Loading meeting...'}</p>
        </div>

        <div className="p-6">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-center">{error}</div>}

          {step === 1 && event?.status === 'open' && (
            <form onSubmit={handleConfirm} className="space-y-4">
              <div className={`rounded-lg border p-3 text-sm ${accuracyStyle}`} aria-live="polite">
                {!location ? (
                  <div className="flex items-center justify-between gap-3">
                    <span>{locationError || 'Check your GPS before submitting.'}</span>
                    <button type="button" onClick={startLocationTracking} disabled={watchingLocation}
                      className="shrink-0 rounded-md bg-white px-3 py-2 font-semibold shadow-sm disabled:opacity-60">
                      {watchingLocation ? 'Locating…' : 'Check location'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-semibold">GPS accuracy: about {Math.round(location.accuracy)}m</p>
                    <p>{distanceToVenue}m from venue · radius {event.location.radius}m</p>
                    <p className="text-xs">
                      {withinReliableRadius
                        ? 'Location estimate fits within the venue radius.'
                        : 'Your location may need admin review. Move closer or wait for a better GPS signal.'}
                    </p>
                    {locationError && <p className="text-xs">{locationError}</p>}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required
                  className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Register Number</label>
                <input type="text" name="regNumber" value={formData.regNumber} onChange={handleChange} required
                  className="w-full border border-gray-300 rounded-lg p-3 uppercase outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                  <input type="text" name="course" value={formData.course} onChange={handleChange} required
                    className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sem / Section</label>
                  <input type="text" name="section" value={formData.section} onChange={handleChange} required
                    placeholder="e.g. 5 D"
                    className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">4-Digit Attendance Code</label>
                <input type="text" name="code" maxLength="4" value={formData.code} onChange={handleChange} required
                  placeholder="Enter venue code"
                  className="w-full border border-gray-300 rounded-lg p-3 text-center text-xl font-bold tracking-widest outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 mt-2 rounded-lg hover:bg-blue-700 transition">
                {loading ? 'Verifying...' : 'Mark Attendance'}
              </button>
            </form>
          )}

          {step === 1 && event && event.status !== 'open' && (
            <div className="rounded-lg bg-yellow-50 p-4 text-center text-yellow-800">
              This meeting is not currently accepting attendance.
            </div>
          )}

          {step === 2 && result && (
            <div className="text-center space-y-4">
              <div className={result.status === 'present' ? "text-green-500 text-6xl" : "text-yellow-500 text-6xl"}>
                {result.status === 'present' ? '✓' : '⚠️'}
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                {result.status === 'present' ? 'Attendance Recorded' : 'Needs Review'}
              </h2>
              <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600 text-left space-y-2">
                <p><strong>Name:</strong> {result.user.name}</p>
                <p><strong>Register No:</strong> {result.user.regNumber}</p>
                <p><strong>Location:</strong> {result.distance}m from venue</p>
                <p><strong>Status:</strong> <span className="uppercase font-bold">{result.status}</span></p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}