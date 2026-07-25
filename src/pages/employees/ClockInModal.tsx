import { useState } from 'react';
import { useStore } from '../../store';
import { Button, Modal } from '../../components/ui';
import { Clock, LogOut } from 'lucide-react';
import { formatDateTime, durationHours } from '../../utils';

type Step = 'pin' | 'select_job' | 'clocked_in';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ClockInModal({ open, onClose }: Props) {
  const { employees, jobs, timeEntries, clockIn, clockOut } = useStore();
  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [foundEmployee, setFoundEmployee] = useState<typeof employees[0] | null>(null);
  const [selectedJob, setSelectedJob] = useState('');
  const [breakMin, setBreakMin] = useState(0);

  const reset = () => {
    setStep('pin');
    setPin('');
    setPinError('');
    setFoundEmployee(null);
    setSelectedJob('');
    setBreakMin(0);
  };

  const handleClose = () => { reset(); onClose(); };

  const tryPin = (nextPin: string) => {
    const emp = employees.find((e) => e.pin === nextPin && e.active);
    if (!emp) {
      setPinError('Invalid PIN. Try again.');
      setPin('');
      return;
    }
    setPinError('');
    setFoundEmployee(emp);
    setStep('select_job');
  };

  const activeEntry = foundEmployee
    ? timeEntries.find((te) => te.employeeId === foundEmployee.id && te.status === 'clocked_in')
    : null;

  const handleClockIn = () => {
    if (!foundEmployee || !selectedJob) return;
    clockIn(foundEmployee.id, selectedJob);
    setStep('clocked_in');
  };

  const handleClockOut = () => {
    if (!activeEntry) return;
    clockOut(activeEntry.id, breakMin, '');
    reset();
    onClose();
  };

  const activeJobs = jobs.filter((j) => j.status === 'in_progress' || j.status === 'scheduled');

  return (
    <Modal open={open} onClose={handleClose} title="Employee Clock In / Out">
      {/* PIN entry */}
      {step === 'pin' && (
        <div className="flex flex-col items-center gap-6 py-4">
          <Clock size={48} className="text-brand-500" />
          <p className="text-gray-600 text-center">Enter your 4-digit PIN to clock in or out.</p>
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg font-bold transition-colors ${
                  pin.length > i ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 bg-gray-50'
                }`}
              >
                {pin.length > i ? '●' : ''}
              </div>
            ))}
          </div>
          {pinError && <p className="text-red-500 text-sm">{pinError}</p>}
          {/* Number pad */}
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((d, idx) => (
              <button
                key={idx}
                disabled={d === ''}
                onClick={() => {
                  if (d === '⌫') { setPin((p) => p.slice(0, -1)); return; }
                  if (typeof d === 'number' && pin.length < 4) {
                    const next = pin + d;
                    setPin(next);
                    if (next.length === 4) {
                      tryPin(next);
                    }
                  }
                }}
                className={`w-16 h-16 rounded-full text-xl font-semibold transition-colors
                  ${d === '' ? 'invisible' : 'bg-gray-100 hover:bg-brand-100 active:bg-brand-200 text-gray-800'}
                `}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Already clocked in → show clock-out option */}
      {step === 'select_job' && foundEmployee && activeEntry && (
        <div className="flex flex-col items-center gap-6 py-4">
          <LogOut size={48} className="text-red-500" />
          <div className="text-center">
            <p className="font-semibold text-gray-900 text-lg">{foundEmployee.name}</p>
            <p className="text-gray-500 text-sm mt-1">
              Clocked in since {formatDateTime(activeEntry.clockIn)}
            </p>
            <p className="text-brand-600 font-semibold mt-1">
              {durationHours(activeEntry.clockIn).toFixed(2)} hrs worked
            </p>
          </div>
          <div className="w-full space-y-2">
            <label className="text-sm font-medium text-gray-700">Break time (minutes)</label>
            <input
              type="number"
              min={0}
              value={breakMin}
              onChange={(e) => setBreakMin(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <Button variant="danger" className="w-full justify-center py-3 text-base" onClick={handleClockOut}>
            <LogOut size={18} /> Clock Out
          </Button>
          <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
        </div>
      )}

      {/* Select job to clock in */}
      {step === 'select_job' && foundEmployee && !activeEntry && (
        <div className="flex flex-col gap-6 py-4">
          <div className="text-center">
            <p className="font-semibold text-gray-900 text-lg">{foundEmployee.name}</p>
            <p className="text-gray-500 text-sm">Select a job to clock in to</p>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activeJobs.map((j) => (
              <button
                key={j.id}
                onClick={() => setSelectedJob(j.id)}
                className={`w-full text-left border rounded-lg p-3 text-sm transition-colors ${
                  selectedJob === j.id
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-gray-200 hover:border-brand-300'
                }`}
              >
                <p className="font-medium">{j.title}</p>
              </button>
            ))}
            {activeJobs.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">No active or scheduled jobs.</p>
            )}
          </div>
          <Button disabled={!selectedJob} className="w-full justify-center py-3 text-base" onClick={handleClockIn}>
            <Clock size={18} /> Clock In
          </Button>
          <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600 text-center">← Back</button>
        </div>
      )}

      {/* Success */}
      {step === 'clocked_in' && foundEmployee && (
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Clock size={32} className="text-green-600" />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">You're clocked in!</p>
            <p className="text-gray-500 mt-1">{foundEmployee.name}</p>
          </div>
          <Button className="w-full justify-center" onClick={handleClose}>Done</Button>
        </div>
      )}
    </Modal>
  );
}
