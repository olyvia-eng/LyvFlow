import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useStore } from '../../store';
import { Card, PageHeader, StatCard, Button, Select } from '../../components/ui';
import { durationHours, formatDateTime } from '../../utils';
import type { BusinessUserRole } from '../../auth/types';
import type { TimeEntry, TimeEntryWorkType } from '../../types';
import { emitAppToast } from '../../toast';

interface TimeReportsPageProps {
  currentUserRole: BusinessUserRole;
}

type WorkTypeFilter = 'all' | TimeEntryWorkType;
type EmployeeFilter = 'all' | string;

function normalizeWorkType(entry: Partial<TimeEntry>): TimeEntryWorkType {
  if (entry.workType === 'drive_time' || entry.workType === 'non_billable') return entry.workType;
  return 'job';
}

function normalizeJobIds(entry: Partial<TimeEntry>): string[] {
  if (Array.isArray(entry.jobIds) && entry.jobIds.length > 0) {
    return entry.jobIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  }
  if (typeof entry.jobId === 'string' && entry.jobId.trim().length > 0) {
    return [entry.jobId];
  }
  return [];
}

function entryLabel(entry: Partial<TimeEntry>, jobs: Array<{ id: string; title: string }>) {
  const workType = normalizeWorkType(entry);
  if (workType === 'drive_time') return 'Drive Time';
  if (workType === 'non_billable') return 'Non-Billable Work';

  const jobIds = normalizeJobIds(entry);
  const titles = jobIds
    .map((jobId) => jobs.find((job) => job.id === jobId)?.title)
    .filter((value): value is string => Boolean(value));

  return titles.length > 0 ? titles.join(', ') : 'Job Work';
}

export default function TimeReportsPage({ currentUserRole }: TimeReportsPageProps) {
  const { timeEntries, jobs, employees, updateTimeEntry } = useStore();
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [workTypeFilter, setWorkTypeFilter] = useState<WorkTypeFilter>('all');
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>('all');
  const [backfillRunning, setBackfillRunning] = useState(false);

  const filteredEntries = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59.999`);

    return [...timeEntries]
      .filter((entry) => {
        const clockInDate = new Date(entry.clockIn);
        if (Number.isNaN(clockInDate.getTime())) return false;
        if (clockInDate < start || clockInDate > end) return false;

            if (employeeFilter !== 'all' && entry.employeeId !== employeeFilter) return false;

        const workType = normalizeWorkType(entry);
        if (workTypeFilter !== 'all' && workType !== workTypeFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
  }, [employeeFilter, endDate, startDate, timeEntries, workTypeFilter]);

  const totalsByType = useMemo(() => {
    const totals: Record<TimeEntryWorkType, number> = {
      job: 0,
      drive_time: 0,
      non_billable: 0,
    };

    filteredEntries.forEach((entry) => {
      const workType = normalizeWorkType(entry);
      totals[workType] += durationHours(entry.clockIn, entry.clockOut, entry.breakMinutes);
    });

    return totals;
  }, [filteredEntries]);

  const employeeTotals = useMemo(() => {
    const map = new Map<string, number>();
    filteredEntries.forEach((entry) => {
      const hours = durationHours(entry.clockIn, entry.clockOut, entry.breakMinutes);
      map.set(entry.employeeId, (map.get(entry.employeeId) ?? 0) + hours);
    });

    return [...map.entries()]
      .map(([employeeId, hours]) => ({
        employeeId,
        name: employees.find((employee) => employee.id === employeeId)?.name ?? 'Unknown',
        hours,
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [employees, filteredEntries]);

  const jobTotals = useMemo(() => {
    const map = new Map<string, number>();

    filteredEntries.forEach((entry) => {
      if (normalizeWorkType(entry) !== 'job') return;
      const jobIds = normalizeJobIds(entry);
      if (jobIds.length === 0) return;

      const hoursShare = durationHours(entry.clockIn, entry.clockOut, entry.breakMinutes) / jobIds.length;
      jobIds.forEach((jobId) => {
        map.set(jobId, (map.get(jobId) ?? 0) + hoursShare);
      });
    });

    return [...map.entries()]
      .map(([jobId, hours]) => ({
        jobId,
        title: jobs.find((job) => job.id === jobId)?.title ?? 'Unknown job',
        hours,
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [filteredEntries, jobs]);

  const legacyEntries = useMemo(
    () =>
      timeEntries.filter((entry) => {
        const hasWorkType = typeof entry.workType === 'string';
        const jobIds = normalizeJobIds(entry);
        return !hasWorkType || (normalizeWorkType(entry) === 'job' && jobIds.length === 0 && typeof entry.jobId === 'string');
      }),
    [timeEntries]
  );

  const backfillLegacyEntries = async () => {
    setBackfillRunning(true);
    try {
      for (const entry of legacyEntries) {
        const existingJobIds = normalizeJobIds(entry);
        const nextWorkType = typeof entry.workType === 'string'
          ? normalizeWorkType(entry)
          : (existingJobIds.length > 0 || typeof entry.jobId === 'string' ? 'job' : 'non_billable');
        const nextJobIds = nextWorkType === 'job'
          ? (existingJobIds.length > 0 ? existingJobIds : (typeof entry.jobId === 'string' ? [entry.jobId] : []))
          : [];

        await updateTimeEntry(entry.id, {
          workType: nextWorkType,
          jobId: nextWorkType === 'job' ? (entry.jobId ?? nextJobIds[0]) : undefined,
          jobIds: nextJobIds,
          breakMinutes: entry.breakMinutes ?? 0,
          notes: entry.notes ?? '',
          status: entry.status ?? 'clocked_out',
          clockIn: entry.clockIn,
          clockOut: entry.clockOut,
          employeeId: entry.employeeId,
        });
      }

      emitAppToast({ tone: 'success', message: 'Legacy time entries backfilled successfully.' });
    } finally {
      setBackfillRunning(false);
    }
  };

  const totalHours = filteredEntries.reduce((sum, entry) => sum + durationHours(entry.clockIn, entry.clockOut, entry.breakMinutes), 0);

  return (
    <div>
      <PageHeader
        title="Time Reports"
        subtitle="Filter hours by date, type, employee, and job."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Hours" value={`${totalHours.toFixed(1)} hrs`} />
        <StatCard label="Job Work" value={`${totalsByType.job.toFixed(1)} hrs`} color="text-blue-600" />
        <StatCard label="Drive Time" value={`${totalsByType.drive_time.toFixed(1)} hrs`} color="text-amber-600" />
        <StatCard label="Non-Billable" value={`${totalsByType.non_billable.toFixed(1)} hrs`} color="text-slate-600" />
      </div>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <label className="text-sm text-gray-600">
            <span className="block mb-1 font-medium text-gray-700">Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-gray-600">
            <span className="block mb-1 font-medium text-gray-700">End Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div>
            <Select label="Work Type" value={workTypeFilter} onChange={(event) => setWorkTypeFilter(event.target.value as WorkTypeFilter)}>
              <option value="all">All Types</option>
              <option value="job">Job Work</option>
              <option value="drive_time">Drive Time</option>
              <option value="non_billable">Non-Billable Work</option>
            </Select>
          </div>
          <div>
            <Select label="Employee" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value as EmployeeFilter)}>
              <option value="all">All Employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <p className="text-sm text-gray-500">Showing {filteredEntries.length} entries</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Hours by Employee</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-left text-xs">
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="py-2 font-medium text-right">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employeeTotals.length === 0 ? (
                  <tr><td colSpan={2} className="px-4 py-4 text-sm text-gray-400">No entries in this range.</td></tr>
                ) : employeeTotals.map((item) => (
                  <tr key={item.employeeId}>
                    <td className="px-4 py-2">{item.name}</td>
                    <td className="py-2 text-right font-semibold">{item.hours.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Hours by Job</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-left text-xs">
                  <th className="px-4 py-2 font-medium">Job</th>
                  <th className="py-2 font-medium text-right">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {jobTotals.length === 0 ? (
                  <tr><td colSpan={2} className="px-4 py-4 text-sm text-gray-400">No job work in this range.</td></tr>
                ) : jobTotals.map((item) => (
                  <tr key={item.jobId}>
                    <td className="px-4 py-2">{item.title}</td>
                    <td className="py-2 text-right font-semibold">{item.hours.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-800">Time Entry Detail</h2>
            <p className="text-xs text-gray-500">Job totals split evenly across selected jobs.</p>
          </div>
          {currentUserRole === 'admin' && (
            <div className="flex items-center gap-3">
              <p className="text-xs text-gray-500">Legacy entries needing backfill: {legacyEntries.length}</p>
              <Button onClick={() => void backfillLegacyEntries()} disabled={backfillRunning || legacyEntries.length === 0}>
                {backfillRunning ? 'Backfilling...' : 'Backfill Legacy Entries'}
              </Button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-left text-xs">
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 font-medium">Work</th>
                <th className="py-2 font-medium">Clock In</th>
                <th className="py-2 font-medium">Clock Out</th>
                <th className="py-2 font-medium">Notes</th>
                <th className="py-2 font-medium text-right">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredEntries.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-gray-400">No entries match these filters.</td></tr>
              ) : filteredEntries.map((entry) => {
                const employee = employees.find((item) => item.id === entry.employeeId);
                const workType = normalizeWorkType(entry);
                const hours = durationHours(entry.clockIn, entry.clockOut, entry.breakMinutes);
                return (
                  <tr key={entry.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-2 font-medium text-gray-800">{employee?.name ?? 'Unknown'}</td>
                    <td className="py-2 capitalize text-gray-600">{workType.replace('_', ' ')}</td>
                    <td className="py-2 text-gray-600 max-w-xs truncate">{entryLabel(entry, jobs)}</td>
                    <td className="py-2 text-gray-500 text-xs">{formatDateTime(entry.clockIn)}</td>
                    <td className="py-2 text-gray-500 text-xs">{entry.clockOut ? formatDateTime(entry.clockOut) : <span className="text-green-600 font-medium">Active</span>}</td>
                    <td className="py-2 text-gray-600 max-w-xs truncate">{entry.notes?.trim() ? entry.notes : '—'}</td>
                    <td className="py-2 text-right font-semibold text-brand-600">{hours.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {currentUserRole !== 'admin' && (
        <p className="mt-4 text-xs text-gray-500">Backfill tools are restricted to admin users.</p>
      )}
    </div>
  );
}
