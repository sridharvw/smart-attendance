import { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, Search, Users } from 'lucide-react';
import { API_BASE_URL } from '../api';
import AdminNav from '../components/AdminNav';

export default function AdminDirectory({ onLogout, isDarkMode, onToggleDarkMode }) {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDirectory = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/attendance/directory`);
        setStudents(response.data);
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Could not load the student directory');
      } finally {
        setLoading(false);
      }
    };

    loadDirectory();
  }, []);

  const filteredStudents = students.filter(student => {
    const query = search.toLowerCase();
    return [student.name, student.registerNumber, student.course, student.semester]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(query));
  });

  const downloadCsv = () => {
    const header = 'Register Number,Name,Course,Semester,Attendance Count,NSS Hours,Devices Used\n';
    const rows = filteredStudents.map(student => [
      student.registerNumber,
      `"${student.name.replaceAll('"', '""')}"`,
      student.course,
      student.semester,
      student.totalAttendance,
      student.totalHours,
      `"${(student.deviceIds || []).join('; ')}"`
    ].join(','));
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nss-student-directory.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav onLogout={onLogout} isDarkMode={isDarkMode} onToggleDarkMode={onToggleDarkMode} />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Cumulative Tracker</p>
            <h1 className="text-3xl font-bold text-gray-900">Student Directory</h1>
            <p className="mt-1 text-gray-500">Attendance totals across every completed and active meeting.</p>
          </div>
          <div className="flex gap-2">
            <a href="/admin" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">Live dashboard</a>
            <button onClick={downloadCsv} disabled={!filteredStudents.length} title="Download directory CSV" className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"><Download size={16} /> Export CSV</button>
          </div>
        </div>

        {error && <div className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 text-blue-700"><Users size={20} /></div>
              <div><h2 className="font-bold text-gray-900">All Volunteers</h2><p className="text-sm text-gray-500">{students.length} students registered</p></div>
            </div>
            <label className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-gray-500 sm:w-72">
              <Search size={17} />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search students" className="w-full bg-transparent text-sm text-gray-900 outline-none" />
            </label>
          </div>

          {loading ? <p className="p-6 text-gray-500">Loading directory...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Course / Semester</th><th className="px-5 py-3">Meetings attended</th><th className="px-5 py-3">NSS hours</th><th className="px-5 py-3">Devices used</th><th className="px-5 py-3">Last check-in</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStudents.map(student => (
                    <tr key={student._id} className="hover:bg-gray-50">
                      <td className="px-5 py-4"><div className="font-semibold text-gray-900">{student.name}</div><div className="text-gray-500">{student.registerNumber}</div></td>
                      <td className="px-5 py-4 text-gray-600">{student.course} / {student.semester}</td>
                      <td className="px-5 py-4 font-semibold text-gray-900">{student.totalAttendance}</td>
                      <td className="px-5 py-4 font-semibold text-blue-700">{student.totalHours}</td>
                      <td className="px-5 py-4 text-gray-600">{student.deviceIds?.length ? student.deviceIds.join(', ') : 'Not recorded'}</td>
                      <td className="px-5 py-4 text-gray-500">{student.lastAttendance ? new Date(student.lastAttendance).toLocaleDateString() : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredStudents.length && <p className="p-6 text-center text-gray-500">No students match this search.</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
