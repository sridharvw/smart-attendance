import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import { useParams } from 'react-router-dom';

export default function VolunteerCheckIn() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        
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
            latitude,
            longitude,
            accuracy,
            device_id: deviceId
          });

          setResult(submitRes.data);
          setStep(2);
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to submit attendance');
        }
        setLoading(false);
      },
      () => {
        setError('Please allow location access to mark attendance.');
        setLoading(false);
      }
    );
  };

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