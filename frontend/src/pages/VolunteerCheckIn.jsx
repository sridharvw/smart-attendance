import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Keyboard, QrCode } from 'lucide-react';
import { API_BASE_URL } from '../api';
import { useParams, useSearchParams } from 'react-router-dom';

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
  const [searchParams] = useSearchParams();
  const [attendanceToken, setAttendanceToken] = useState(() => searchParams.get('token') || '');
  const [verificationMethod, setVerificationMethod] = useState('qr');
  const [isScanningQr, setIsScanningQr] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [manualCode, setManualCode] = useState('');
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

  useEffect(() => {
    if (!isScanningQr || verificationMethod !== 'qr' || !event?._id) return undefined;

    let scanner;
    let cancelled = false;
    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      if (cancelled) return;
      scanner = new Html5QrcodeScanner('attendance-qr-reader', {
        fps: 10,
        qrbox: { width: 230, height: 230 },
        rememberLastUsedCamera: true
      }, false);
      scanner.render(decodedText => {
        try {
          const scannedUrl = new URL(decodedText);
          const matchesMeeting = scannedUrl.pathname.endsWith(`/meeting/${event._id}`);
          const token = scannedUrl.searchParams.get('token');
          if (scannedUrl.origin !== window.location.origin || !matchesMeeting || !token) {
            setVerificationError('Scan the current QR displayed for this meeting.');
            return;
          }
          setAttendanceToken(token);
          setVerificationError('');
          setIsScanningQr(false);
        } catch {
          setVerificationError('This QR is not a valid meeting check-in link.');
        }
      }, () => {});
    }).catch(() => setVerificationError('Could not load the QR scanner. Allow camera access and retry.'));

    return () => {
      cancelled = true;
      if (scanner) scanner.clear().catch(() => {});
    };
  }, [event?._id, isScanningQr, verificationMethod]);

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

    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setLocationError('Location access requires HTTPS. Open this meeting using its secure link.');
      return;
    }

    setLocationError('');
    setWatchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy
        });
        setWatchingLocation(false);
      },
      error => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location permission is blocked. Allow location access in your browser settings, then retry.'
          : error.code === error.TIMEOUT
            ? 'GPS is taking too long to respond. Move to a place with a clearer signal and retry.'
            : 'Your device could not determine its location. Turn on location services and retry.';
        setLocationError(message);
        stopLocationTracking();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError('');

    const verificationCredential = verificationMethod === 'qr' ? attendanceToken : manualCode.trim();
    if (!verificationCredential) {
      setError(verificationMethod === 'qr' ? 'Scan the current meeting QR before submitting.' : 'Enter the current six-digit meeting code.');
      return;
    }

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
        ...(verificationMethod === 'qr' ? { token: verificationCredential } : { code: verificationCredential }),
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
      const serverMessage = err.response?.data?.message;
      if (err.response?.status === 400 && /credential|expired|invalid/i.test(serverMessage || '')) {
        if (verificationMethod === 'qr') setAttendanceToken('');
        else setManualCode('');
      }
      setError(serverMessage || 'Failed to submit attendance');
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
              <div className="grid grid-cols-2 rounded-lg border border-gray-200 bg-gray-100 p-1" role="group" aria-label="Attendance verification method">
                <button type="button" aria-pressed={verificationMethod === 'qr'} onClick={() => { setVerificationMethod('qr'); setVerificationError(''); }} className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${verificationMethod === 'qr' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}>
                  <QrCode size={16} /> Scan QR
                </button>
                <button type="button" aria-pressed={verificationMethod === 'code'} onClick={() => { setVerificationMethod('code'); setVerificationError(''); setIsScanningQr(false); }} className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${verificationMethod === 'code' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}>
                  <Keyboard size={16} /> Enter code
                </button>
              </div>

              {verificationMethod === 'qr' ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  {attendanceToken ? <p className="font-semibold">Meeting QR accepted. It expires shortly.</p> : <p>Scan the live QR on the admin dashboard with your camera, or scan it here.</p>}
                  {verificationError && <p className="mt-2 text-red-700" role="alert">{verificationError}</p>}
                  {!attendanceToken && !isScanningQr && <button type="button" onClick={() => { setVerificationError(''); setIsScanningQr(true); }} className="mt-3 flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 font-semibold text-white hover:bg-blue-800"><QrCode size={16} /> Open camera scanner</button>}
                  {isScanningQr && <div id="attendance-qr-reader" className="mt-3 overflow-hidden rounded-md bg-white" />}
                </div>
              ) : (
                <div>
                  <label htmlFor="meeting-code" className="mb-1 block text-sm font-medium text-gray-700">6-digit meeting code</label>
                  <input id="meeting-code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={manualCode} onChange={event => setManualCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required placeholder="Enter current code" className="w-full rounded-lg border border-gray-300 p-3 text-center text-xl font-bold tracking-[0.4em] outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="mt-1 text-xs text-gray-500">Ask the admin for the code currently shown on the dashboard. It changes every 30 seconds.</p>
                  {verificationError && <p className="mt-2 text-sm text-red-700" role="alert">{verificationError}</p>}
                </div>
              )}

              <div className={`rounded-lg border p-3 text-sm ${accuracyStyle}`} aria-live="polite">
                {!location ? (
                  <div className="flex items-center justify-between gap-3">
                    <span>{locationError || 'Check your GPS before submitting.'}</span>
                    <button type="button" onClick={startLocationTracking} disabled={watchingLocation}
                      className="shrink-0 rounded-md bg-white px-3 py-2 font-semibold shadow-sm disabled:opacity-60">
                      {watchingLocation ? 'Locating…' : locationError ? 'Retry location' : 'Check location'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-semibold">GPS accuracy: about {Math.round(location.accuracy)}m</p>
                    <p>{distanceToVenue}m from venue · radius {event.location.radius}m</p>
                    <p className="text-xs">
                      {withinReliableRadius
                        ? 'Location estimate fits within the venue radius.'
                        : 'Check-in is blocked until GPS accuracy and venue distance fit the meeting radius. Refresh GPS or move closer.'}
                    </p>
                    {locationError && <p className="text-xs">{locationError}</p>}
                    <button type="button" onClick={startLocationTracking} disabled={watchingLocation} className="mt-2 rounded-md bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm disabled:opacity-60">
                      {watchingLocation ? 'Updating GPS...' : 'Refresh GPS'}
                    </button>
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

              <button type="submit" disabled={loading || (verificationMethod === 'qr' ? !attendanceToken : manualCode.length !== 6)} className="w-full bg-blue-600 text-white font-bold py-3 mt-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
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