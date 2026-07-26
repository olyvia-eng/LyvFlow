import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, LogOut, ShieldCheck } from 'lucide-react';
import { useStore } from '../../store';
import { Button, Card, Input, Select } from '../../components/ui';
import { durationHours, formatDateTime } from '../../utils';

export default function EmployeePortalPage() {
  const { employees, jobs, timeEntries, clockIn, clockOut } = useStore();

  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [breakMinutes, setBreakMinutes] = useState(0);

  const employee = useMemo(
    () => employees.find((item) => item.id === employeeId) ?? null,
    [employees, employeeId]
  );

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

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();

    const cleanPin = pin.replace(/\D/g, '').slice(0, 4);
    if (cleanPin.length !== 4) {
      setPinError('Enter your 4-digit PIN.');
      return;
    }

    const foundEmployee = employees.find(
      (item) => item.active && item.pin === cleanPin
    );

    if (!foundEmployee) {
      setPinError('Invalid PIN. Please try again.');
      return;
    }

    setPinError('');
    setPin('');
    setSelectedJobId('');
    setEmployeeId(foundEmployee.id);
  };

  const handleLogout = () => {
    setEmployeeId(null);
    setSelectedJobId('');
    setBreakMinutes(0);
    setPin('');
    setPinError('');
  };

  const handleClockIn = () => {
    if (!employee || !selectedJobId) return;
    clockIn(employee.id, selectedJobId);
    setSelectedJobId('');
  };

  const handleClockOut = () => {
    if (!activeEntry) return;
    clockOut(activeEntry.id, breakMinutes, '');
    setBreakMinutes(0);
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
            <form className="space-y-4" onSubmit={handleLogin}>
              <Input
                label="4-Digit PIN"
                type="password"
                value={pin}
                maxLength={4}
                autoComplete="off"
                inputMode="numeric"
                onChange={(event) => {
                  setPin(event.target.value.replace(/\D/g, '').slice(0, 4));
                  if (pinError) setPinError('');
                }}
                error={pinError || undefined}
              />
              <Button type="submit" className="w-full justify-center py-2.5">
                <Clock size={16} /> Log In
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm text-gray-500">Signed in as</p>
                <p className="text-base font-semibold text-gray-900">{employee.name}</p>
              </div>

              {activeEntry ? (
                <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="font-semibold text-green-800">You are clocked in.</p>
                  <p className="text-sm text-green-700">
                    Since {formatDateTime(activeEntry.clockIn)}
                  </p>
                  <p className="text-sm text-green-700">
                    Hours so far: {durationHours(activeEntry.clockIn).toFixed(2)}
                  </p>
                  <Input
                    label="Break (minutes)"
                    type="number"
                    min={0}
                    value={breakMinutes}
                    onChange={(event) => setBreakMinutes(Number(event.target.value) || 0)}
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
                  <p className="font-semibold text-blue-800">Select a job to clock in</p>
                  <Select
                    value={selectedJobId}
                    onChange={(event) => setSelectedJobId(event.target.value)}
                  >
                    <option value="">Choose a job</option>
                    {activeJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </Select>
                  <Button
                    onClick={handleClockIn}
                    disabled={!selectedJobId}
                    className="w-full justify-center"
                  >
                    <Clock size={16} /> Clock In
                  </Button>
                  {activeJobs.length === 0 && (
                    <p className="text-sm text-blue-700">No active or scheduled jobs are available.</p>
                  )}
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
