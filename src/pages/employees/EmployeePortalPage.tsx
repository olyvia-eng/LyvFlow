import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, LogOut, ShieldCheck } from 'lucide-react';
import { useStore } from '../../store';
import { Button, Card, Input, Select } from '../../components/ui';
import { durationHours, formatDateTime } from '../../utils';
import type { TimeEntryWorkType } from '../../types';

interface EmployeePortalPageProps {
  sessionEmployeeEmail?: string;
  onLogout?: () => void | Promise<void>;
}

export default function EmployeePortalPage({ sessionEmployeeEmail, onLogout }: EmployeePortalPageProps) {
  const { employees, jobs, timeEntries, clockIn, clockOut } = useStore();

  const [clockType, setClockType] = useState<TimeEntryWorkType>('job');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [jobNotes, setJobNotes] = useState('');

  const sessionEmployee = useMemo(() => {
    if (!sessionEmployeeEmail) return null;
    return (
      employees.find(
        (item) => item.active && item.email.toLowerCase() === sessionEmployeeEmail.toLowerCase()
      ) ?? null
    );
  }, [employees, sessionEmployeeEmail]);

  const employee = sessionEmployee;

  const activeEntry = useMemo(() => {
    if (!employee) return null;
    return (
      timeEntries.find(
        (entry) => entry.employeeId === employee.id && entry.status === 'clocked_in'
      ) ?? null
    );
  }, [employee, timeEntries]);

  const activeJobs = jobs.filter(
    (job) => job.status === 'in_progress' || job.status === 'scheduled'
  );

  const handleLogout = () => {
    if (sessionEmployeeEmail && onLogout) {
      void onLogout();
      return;
    }

    setClockType('job');
    setSelectedJobIds([]);
    setJobNotes('');
  };

  const handleClockIn = () => {
    if (!employee) return;
    if (clockType === 'job' && selectedJobIds.length === 0) return;

    clockIn(employee.id, {
      workType: clockType,
      jobIds: clockType === 'job' ? selectedJobIds : [],
    });
    setSelectedJobIds([]);
  };

  const handleClockOut = () => {
    if (!activeEntry) return;
    clockOut(activeEntry.id, 0, jobNotes.trim());
    setJobNotes('');
  };

  const activeEntryJobTitle = useMemo(() => {
    if (!activeEntry) return '—';
    if (activeEntry.workType === 'drive_time') return 'Drive Time';
    if (activeEntry.workType === 'non_billable') return 'Non-Billable Work';

    const ids = Array.isArray(activeEntry.jobIds) && activeEntry.jobIds.length > 0
      ? activeEntry.jobIds
      : (activeEntry.jobId ? [activeEntry.jobId] : []);
    const titles = ids
      .map((id) => jobs.find((job) => job.id === id)?.title)
      .filter((value): value is string => Boolean(value));
    return titles.length > 0 ? titles.join(', ') : 'Job Work';
  }, [activeEntry, jobs]);

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobIds((current) =>
      current.includes(jobId)
        ? current.filter((id) => id !== jobId)
        : [...current, jobId]
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <Card className="p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Employee Clock Portal</h1>
              <p className="mt-1 text-sm text-gray-500">
                This view only allows clock in and clock out.
              </p>
            </div>
            <ShieldCheck className="text-brand-600" size={28} />
          </div>

          {!employee ? (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              Your employee profile could not be found for this account. Ask an admin to create or reconnect your employee record.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm text-gray-500">Signed in as</p>
                <p className="text-base font-semibold text-gray-900">{employee.name}</p>
                <p className="text-xs text-gray-500">{employee.email} · {employee.role.replace('_', ' ')}</p>
              </div>

              {activeEntry ? (
                <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="font-semibold text-green-800">You are clocked in.</p>
                  <p className="text-sm text-green-700">
                    Since {formatDateTime(activeEntry.clockIn)}
                  </p>
                  <p className="text-sm text-green-700">{activeEntryJobTitle}</p>
                  <p className="text-sm text-green-700">
                    Hours so far: {durationHours(activeEntry.clockIn).toFixed(2)}
                  </p>
                  <Input
                    label="Job Notes"
                    value={jobNotes}
                    onChange={(event) => setJobNotes(event.target.value)}
                  />
                  <Button
                    variant="danger"
                    onClick={handleClockOut}
                    className="w-full justify-center"
                  >
                    <LogOut size={16} /> Clock Out
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="font-semibold text-blue-800">Choose clock-in type</p>
                  <Select
                    value={clockType}
                    onChange={(event) => {
                      const next = event.target.value as TimeEntryWorkType;
                      setClockType(next);
                      if (next !== 'job') setSelectedJobIds([]);
                    }}
                  >
                    <option value="job">Job Work</option>
                    <option value="drive_time">Drive Time</option>
                    <option value="non_billable">Non-Billable Work</option>
                  </Select>

                  {clockType === 'job' && (
                    <div className="space-y-2">
                      <p className="text-sm text-blue-800">Select one or more jobs</p>
                      <div className="max-h-44 overflow-y-auto rounded-lg border border-blue-200 bg-white p-2">
                        {activeJobs.map((job) => (
                          <label key={job.id} className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={selectedJobIds.includes(job.id)}
                              onChange={() => toggleJobSelection(job.id)}
                            />
                            <span>{job.title}</span>
                          </label>
                        ))}
                        {activeJobs.length === 0 && (
                          <p className="text-sm text-blue-700 px-2 py-1">No active or scheduled jobs are available.</p>
                        )}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleClockIn}
                    disabled={clockType === 'job' && selectedJobIds.length === 0}
                    className="w-full justify-center"
                  >
                    <Clock size={16} /> Clock In
                  </Button>
                </div>
              )}

              <Button variant="secondary" onClick={handleLogout} className="w-full justify-center">
                Log Out
              </Button>
            </div>
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-gray-500">
          Admin access is available in the main app at <Link to="/" className="text-brand-600 hover:underline">dashboard</Link>.
        </p>
      </div>
    </div>
  );
}
