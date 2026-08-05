import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { Card, Button, Badge, Modal, Input, Select } from '../../components/ui';
import { statusColor, formatCurrency, formatDate, formatDateTime, durationHours } from '../../utils';
import { HIGH_LABOR_VARIANCE_THRESHOLD_PCT, LOW_MARGIN_THRESHOLD_PCT } from '../../config/profitability';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import type { CostEntry, LineItemCategory, JobStatus } from '../../types';

const CATEGORIES: LineItemCategory[] = ['material', 'equipment', 'labour', 'subcontractor'];

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { jobs, customers, employees, timeEntries, updateJob, addCostEntry, deleteTimeEntry } = useStore();

  const job = jobs.find((j) => j.id === id);
  if (!job) return <div className="p-8 text-gray-400">Job not found.</div>;

  const customer = customers.find((c) => c.id === job.customerId);
  const assignedEmployees = employees.filter((e) => job.assignedEmployeeIds.includes(e.id));
  const entryJobIds = (entry: { jobIds?: string[]; jobId?: string }) =>
    Array.isArray(entry.jobIds) && entry.jobIds.length > 0
      ? entry.jobIds
      : (entry.jobId ? [entry.jobId] : []);

  const jobTimeEntries = timeEntries.filter((te) => entryJobIds(te).includes(id));

  const actualCostTotal = job.actualCosts.reduce((s, c) => s + c.total, 0);
  const profit = job.contractValue - actualCostTotal;
  const marginPct = job.contractValue > 0 ? (profit / job.contractValue) * 100 : 0;
  const hoursPct = job.estimatedHours > 0 ? Math.min(100, (job.actualHours / job.estimatedHours) * 100) : 0;

  const profitability = useMemo(() => {
    let trackedHours = 0;
    let trackedBillableHours = 0;
    let trackedNonBillableHours = 0;
    let trackedLaborCost = 0;

    for (const entry of jobTimeEntries) {
      const ids = entryJobIds(entry);
      const divisor = ids.length > 0 ? ids.length : 1;
      const sharedHours = durationHours(entry.clockIn, entry.clockOut, entry.breakMinutes) / divisor;

      trackedHours += sharedHours;
      if (entry.workType === 'non_billable') trackedNonBillableHours += sharedHours;
      else trackedBillableHours += sharedHours;

      const rate = employees.find((employee) => employee.id === entry.employeeId)?.hourlyRate ?? 0;
      trackedLaborCost += sharedHours * rate;
    }

    const recordedLaborCosts = job.actualCosts
      .filter((cost) => cost.category === 'labour')
      .reduce((sum, cost) => sum + cost.total, 0);
    const recordedNonLaborCosts = job.actualCosts
      .filter((cost) => cost.category !== 'labour')
      .reduce((sum, cost) => sum + cost.total, 0);

    const projectedCostFromTracking = trackedLaborCost + recordedNonLaborCosts;
    const projectedProfitFromTracking = job.contractValue - projectedCostFromTracking;
    const projectedMarginFromTracking =
      job.contractValue > 0 ? (projectedProfitFromTracking / job.contractValue) * 100 : 0;
    const laborVariance = recordedLaborCosts - trackedLaborCost;
    const laborVariancePct = trackedLaborCost > 0 ? (laborVariance / trackedLaborCost) * 100 : 0;

    return {
      trackedHours,
      trackedBillableHours,
      trackedNonBillableHours,
      trackedLaborCost,
      recordedLaborCosts,
      recordedNonLaborCosts,
      projectedCostFromTracking,
      projectedProfitFromTracking,
      projectedMarginFromTracking,
      laborVariance,
      laborVariancePct,
    };
  }, [employees, job.actualCosts, job.contractValue, jobTimeEntries]);

  const profitabilityWarnings = useMemo(() => {
    const warnings: Array<{ label: string; className: string }> = [];

    if (job.estimatedHours > 0 && job.actualHours > job.estimatedHours) {
      warnings.push({ label: 'Over Hours', className: 'bg-accent-100 text-accent-700' });
    }

    if (profitability.projectedMarginFromTracking < LOW_MARGIN_THRESHOLD_PCT) {
      warnings.push({ label: `Low Margin (<${LOW_MARGIN_THRESHOLD_PCT}%)`, className: 'bg-accent-50 text-accent-600' });
    }

    if (Math.abs(profitability.laborVariancePct) > HIGH_LABOR_VARIANCE_THRESHOLD_PCT) {
      warnings.push({ label: `Labor Variance High (>${HIGH_LABOR_VARIANCE_THRESHOLD_PCT}%)`, className: 'bg-brand-100 text-brand-700' });
    }

    return warnings;
  }, [job.actualHours, job.estimatedHours, profitability.laborVariancePct, profitability.projectedMarginFromTracking]);

  const timeEntryTypeMeta = (entry: { workType?: string }) => {
    if (entry.workType === 'drive_time') {
      return { label: 'Drive Time', className: 'bg-accent-50 text-accent-600' };
    }
    if (entry.workType === 'non_billable') {
      return { label: 'Non-Billable', className: 'bg-brand-100 text-brand-700' };
    }
    return { label: 'Job Work', className: 'bg-brand-200 text-brand-800' };
  };

  const [costModal, setCostModal] = useState(false);
  const [costForm, setCostForm] = useState<Omit<CostEntry, 'id'>>({
    category: 'labour', description: '', quantity: 1, unit: 'hr', unitCost: 0, total: 0, date: new Date().toISOString().slice(0, 10),
  });

  const setC = (key: keyof typeof costForm, value: unknown) =>
    setCostForm((f) => {
      const updated = { ...f, [key]: value };
      updated.total = Number(updated.quantity) * Number(updated.unitCost);
      return updated;
    });

  const saveCost = () => {
    if (!costForm.description.trim()) return;
    addCostEntry(job.id, costForm);
    setCostModal(false);
  };

  return (
    <div>
      <div className="mb-4">
        <button onClick={() => navigate('/jobs')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 mb-2">
          <ArrowLeft size={15} /> Back to Jobs
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge label={job.status} className={statusColor[job.status]} />
              <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
            </div>
            <p className="text-gray-500">{customer?.name ?? '—'} · Started {formatDate(job.startDate)}</p>
          </div>
          <Select
            value={job.status}
            onChange={(e) => updateJob(job.id, { status: e.target.value as JobStatus })}
          >
            {(['scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled'] as JobStatus[]).map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Contract Value</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(job.contractValue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Actual Costs</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(actualCostTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Gross Profit</p>
          <p className={`text-xl font-bold ${profit >= 0 ? 'text-brand-700' : 'text-accent-700'}`}>
            {formatCurrency(profit)}
          </p>
          <p className="text-xs text-gray-400">{marginPct.toFixed(1)}% margin</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Hours</p>
          <p className="text-xl font-bold text-gray-900">{job.actualHours.toFixed(1)}/{job.estimatedHours}h</p>
          <div className="mt-1 bg-gray-100 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full ${hoursPct >= 100 ? 'bg-accent-600' : 'bg-brand-500'}`} style={{ width: `${hoursPct}%` }} />
          </div>
        </Card>
      </div>

      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between mb-3 gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Job Profitability (Tracked)</h2>
            {profitabilityWarnings.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {profitabilityWarnings.map((warning) => (
                  <Badge key={warning.label} label={warning.label} className={warning.className} />
                ))}
              </div>
            )}
          </div>
          <span className="text-xs text-gray-500">Uses shared hours for multi-job time entries</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Tracked Hours</p>
            <p className="font-semibold text-gray-900">{profitability.trackedHours.toFixed(2)}h</p>
            <p className="text-xs text-gray-400">Billable {profitability.trackedBillableHours.toFixed(2)}h · Non-billable {profitability.trackedNonBillableHours.toFixed(2)}h</p>
          </div>
          <div>
            <p className="text-gray-500">Tracked Labor Cost</p>
            <p className="font-semibold text-gray-900">{formatCurrency(profitability.trackedLaborCost)}</p>
            <p className="text-xs text-gray-400">Recorded labor costs: {formatCurrency(profitability.recordedLaborCosts)}</p>
            <p className={`text-xs mt-1 ${profitability.laborVariance >= 0 ? 'text-accent-700' : 'text-brand-700'}`}>
              Variance: {formatCurrency(profitability.laborVariance)} ({profitability.laborVariancePct.toFixed(1)}%)
            </p>
          </div>
          <div>
            <p className="text-gray-500">Projected Cost (Tracked)</p>
            <p className="font-semibold text-gray-900">{formatCurrency(profitability.projectedCostFromTracking)}</p>
            <p className="text-xs text-gray-400">Includes non-labor costs: {formatCurrency(profitability.recordedNonLaborCosts)}</p>
          </div>
          <div>
            <p className="text-gray-500">Projected Profit (Tracked)</p>
            <p className={`font-semibold ${profitability.projectedProfitFromTracking >= 0 ? 'text-brand-700' : 'text-accent-700'}`}>
              {formatCurrency(profitability.projectedProfitFromTracking)}
            </p>
            <p className="text-xs text-gray-400">{profitability.projectedMarginFromTracking.toFixed(1)}% margin</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actual Costs */}
        <Card>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold">Actual Costs</h2>
            <Button size="sm" onClick={() => setCostModal(true)}><Plus size={13} /> Add Cost</Button>
          </div>
          {job.actualCosts.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">No costs recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500 text-left text-xs">
                    <th className="px-4 pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {job.actualCosts.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2 text-gray-500 text-xs">{c.date}</td>
                      <td className="py-2 text-xs capitalize">{c.category}</td>
                      <td className="py-2">{c.description}</td>
                      <td className="py-2 text-right font-semibold">{formatCurrency(c.total)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-4 py-2 font-semibold text-right text-sm">Total</td>
                    <td className="py-2 text-right font-bold">{formatCurrency(actualCostTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Time Entries */}
        <Card>
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold">Time Entries</h2>
          </div>
          {jobTimeEntries.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">No time entries for this job.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {jobTimeEntries.map((te) => {
                const emp = employees.find((e) => e.id === te.employeeId);
                const hrs = durationHours(te.clockIn, te.clockOut, te.breakMinutes);
                const typeMeta = timeEntryTypeMeta(te);
                return (
                  <li key={te.id} className="px-4 py-2 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        <span>{emp?.name ?? '—'}</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeMeta.className}`}>
                          {typeMeta.label}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400">{formatDateTime(te.clockIn)} → {te.clockOut ? formatDateTime(te.clockOut) : 'Active'}</p>
                      <p className="text-xs text-gray-500">Notes: {te.notes?.trim() ? te.notes : '—'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-brand-600">{hrs.toFixed(2)}h</span>
                      <button onClick={() => deleteTimeEntry(te.id)} className="text-gray-300 hover:text-accent-700">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Assigned employees & notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Assigned Employees</h2>
          {assignedEmployees.length === 0 ? (
            <p className="text-sm text-gray-400">No employees assigned.</p>
          ) : (
            <ul className="space-y-2">
              {assignedEmployees.map((emp) => (
                <li key={emp.id} className="flex items-center justify-between text-sm">
                  <span>{emp.name}</span>
                  <span className="text-gray-400 capitalize">{emp.role.replace('_', ' ')} · ${emp.hourlyRate}/hr</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Work Areas</h2>
          <p className="text-sm text-gray-600 whitespace-pre-line mb-4">
            {job.workAreas?.length ? job.workAreas.join(', ') : 'No work areas.'}
          </p>
          <h2 className="font-semibold mb-3">Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-line">{job.notes || 'No notes.'}</p>
        </Card>
      </div>

      {/* Add Cost Modal */}
      <Modal open={costModal} onClose={() => setCostModal(false)} title="Add Cost Entry"
        footer={<>
          <Button variant="secondary" onClick={() => setCostModal(false)}>Cancel</Button>
          <Button onClick={saveCost}>Add Cost</Button>
        </>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={costForm.category} onChange={(e) => setC('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </Select>
            <Input label="Date" type="date" value={costForm.date} onChange={(e) => setC('date', e.target.value)} />
          </div>
          <Input label="Description *" required value={costForm.description} onChange={(e) => setC('description', e.target.value)} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Qty" type="number" min={0} value={costForm.quantity} onChange={(e) => setC('quantity', Number(e.target.value))} />
            <Input label="Unit" value={costForm.unit} onChange={(e) => setC('unit', e.target.value)} />
            <Input label="Unit Cost ($)" type="number" min={0} value={costForm.unitCost} onChange={(e) => setC('unitCost', Number(e.target.value))} />
          </div>
          <p className="text-sm font-semibold">Total: {formatCurrency(costForm.total)}</p>
        </div>
      </Modal>
    </div>
  );
}
