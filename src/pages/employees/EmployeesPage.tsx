import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { PageHeader, Button, Card, Badge, Modal, Input, Select, EmptyState } from '../../components/ui';
import { Plus, Pencil, Trash2, Clock, LogOut } from 'lucide-react';
import { formatCurrency, formatDateTime, durationHours } from '../../utils';
import type { Employee, EmployeeRole } from '../../types';
import ClockInModal from './ClockInModal';

const ROLES: EmployeeRole[] = ['admin', 'foreman', 'worker', 'subcontractor'];
const roleColor: Record<EmployeeRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  foreman: 'bg-blue-100 text-blue-700',
  worker: 'bg-green-100 text-green-700',
  subcontractor: 'bg-orange-100 text-orange-700',
};

const empty = (): Omit<Employee, 'id' | 'createdAt'> => ({
  name: '',
  email: '',
  phone: '',
  role: 'worker',
  hourlyRate: 30,
  active: true,
  pin: '',
});

export default function EmployeesPage() {
  const { employees, timeEntries, jobs, addEmployee, updateEmployee, deleteEmployee, clockOut } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(empty());
  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [clockInOpen, setClockInOpen] = useState(false);
  const [clockOutEntry, setClockOutEntry] = useState<string | null>(null);
  const [breakMin, setBreakMin] = useState(0);

  const openNew = () => {
    setEditing(null);
    setForm(empty());
    setNewPassword('');
    setFormError('');
    setModalOpen(true);
  };
  const openEdit = (e: Employee) => {
    setEditing(e);
    setForm({ name: e.name, email: e.email, phone: e.phone, role: e.role, hourlyRate: e.hourlyRate, active: e.active, pin: e.pin });
    setNewPassword('');
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    setFormError('');

    if (!form.name.trim()) {
      setFormError('Full name is required.');
      return;
    }

    if (!form.email.trim()) {
      setFormError('Email is required.');
      return;
    }

    if (form.pin.length !== 4) {
      setFormError('A 4-digit PIN is required for clock in/out.');
      return;
    }

    if (editing) {
      updateEmployee(editing.id, form);
      setModalOpen(false);
      return;
    }

    if (newPassword.length < 8) {
      setFormError('Password must be at least 8 characters for employee login.');
      return;
    }

    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: newPassword,
        role: 'employee',
      }),
    });

    let apiError = 'Could not create employee login.';
    try {
      const payload = await response.json();
      if (typeof payload?.error === 'string') apiError = payload.error;
    } catch {
      // Ignore JSON parsing errors and use generic message.
    }

    if (!response.ok) {
      setFormError(apiError);
      return;
    }

    addEmployee(form);
    setModalOpen(false);
  };

  useEffect(() => {
    if (!modalOpen) {
      setFormError('');
      setNewPassword('');
    }
  }, [modalOpen]);

  const set = (key: keyof typeof form, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const getActiveEntry = (empId: string) =>
    timeEntries.find((te) => te.employeeId === empId && te.status === 'clocked_in');

  const handleClockOut = () => {
    if (!clockOutEntry) return;
    clockOut(clockOutEntry, breakMin, '');
    setClockOutEntry(null);
    setBreakMin(0);
  };

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Manage your team and track time."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setClockInOpen(true)}><Clock size={16} /> Clock In/Out</Button>
            <Button onClick={openNew}><Plus size={16} /> New Employee</Button>
          </div>
        }
      />

      {employees.length === 0 ? (
        <EmptyState title="No employees yet" action={<Button onClick={openNew}><Plus size={16} /> New Employee</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {employees.map((emp) => {
            const activeEntry = getActiveEntry(emp.id);
            const activeJob = activeEntry ? jobs.find((j) => j.id === activeEntry.jobId) : null;
            const todayEntries = timeEntries.filter(
              (te) => te.employeeId === emp.id && te.clockIn.startsWith(new Date().toISOString().slice(0, 10))
            );
            const todayHours = todayEntries.reduce(
              (s, te) => s + durationHours(te.clockIn, te.clockOut, te.breakMinutes),
              0
            );

            return (
              <Card key={emp.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{emp.name}</p>
                    <p className="text-sm text-gray-500">{emp.email}</p>
                  </div>
                  <Badge label={emp.role} className={roleColor[emp.role]} />
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{formatCurrency(emp.hourlyRate)}/hr</p>
                  <p className="text-xs text-gray-400">Today: {todayHours.toFixed(2)} hrs</p>
                </div>

                {/* Clock status */}
                {activeEntry ? (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-2 text-xs">
                    <p className="font-semibold text-green-700">🟢 Clocked In</p>
                    <p className="text-green-600">{activeJob?.title ?? '—'}</p>
                    <p className="text-green-500">Since {formatDateTime(activeEntry.clockIn)}</p>
                    <button
                      onClick={() => setClockOutEntry(activeEntry.id)}
                      className="mt-2 flex items-center gap-1 text-red-600 hover:text-red-700 font-medium"
                    >
                      <LogOut size={12} /> Clock Out
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-gray-400">⚪ Not clocked in</div>
                )}

                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(emp)}><Pencil size={13} /> Edit</Button>
                  <Button variant="danger" size="sm" onClick={() => setConfirmDelete(emp.id)}><Trash2 size={13} /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recent time entries */}
      <div className="mt-8">
        <h2 className="font-semibold text-gray-800 mb-3">Recent Time Entries</h2>
        <Card className="overflow-hidden">
          {timeEntries.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">No time entries.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500 text-left text-xs">
                    <th className="px-4 py-2 font-medium">Employee</th>
                    <th className="py-2 font-medium">Job</th>
                    <th className="py-2 font-medium">Clock In</th>
                    <th className="py-2 font-medium">Clock Out</th>
                    <th className="py-2 font-medium text-right">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...timeEntries].reverse().slice(0, 20).map((te) => {
                    const emp = employees.find((e) => e.id === te.employeeId);
                    const job = jobs.find((j) => j.id === te.jobId);
                    const hrs = durationHours(te.clockIn, te.clockOut, te.breakMinutes);
                    return (
                      <tr key={te.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{emp?.name ?? '—'}</td>
                        <td className="py-2 text-gray-600 truncate max-w-xs">{job?.title ?? '—'}</td>
                        <td className="py-2 text-gray-500 text-xs">{formatDateTime(te.clockIn)}</td>
                        <td className="py-2 text-gray-500 text-xs">{te.clockOut ? formatDateTime(te.clockOut) : <span className="text-green-600 font-medium">Active</span>}</td>
                        <td className="py-2 text-right font-semibold text-brand-600">{hrs.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Employee form modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Employee' : 'New Employee'}
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={() => void handleSave()}>Save</Button>
        </>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Name *" value={form.name} onChange={(e) => set('name', e.target.value)} />
            <Select label="Role" value={form.role} onChange={(e) => set('role', e.target.value as EmployeeRole)}>
              {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            <Input label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Hourly Rate ($)" type="number" min={0} value={form.hourlyRate} onChange={(e) => set('hourlyRate', Number(e.target.value))} />
            <Input label="4-Digit PIN" type="password" maxLength={4} value={form.pin} onChange={(e) => set('pin', e.target.value.replace(/\D/g, '').slice(0, 4))} />
          </div>
          {!editing && (
            <Input
              label="Employee Login Password *"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          )}
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
            <label htmlFor="active" className="text-sm text-gray-700">Active Employee</label>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Employee"
        footer={<>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { deleteEmployee(confirmDelete!); setConfirmDelete(null); }}>Delete</Button>
        </>}
      >
        <p className="text-gray-600">Delete this employee record?</p>
      </Modal>

      {/* Clock Out confirm */}
      <Modal open={!!clockOutEntry} onClose={() => setClockOutEntry(null)} title="Clock Out"
        footer={<>
          <Button variant="secondary" onClick={() => setClockOutEntry(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleClockOut}>Clock Out</Button>
        </>}
      >
        <div className="space-y-4">
          <p className="text-gray-600">Record a break before clocking out?</p>
          <Input label="Break (minutes)" type="number" min={0} value={breakMin} onChange={(e) => setBreakMin(Number(e.target.value))} />
        </div>
      </Modal>

      {/* Clock In modal (mobile-friendly) */}
      <ClockInModal open={clockInOpen} onClose={() => setClockInOpen(false)} />
    </div>
  );
}
