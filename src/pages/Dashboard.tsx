import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useStore } from '../store';
import { Card, PageHeader, StatCard } from '../components/ui';
import { formatCurrency } from '../utils';
import {
  DollarSign,
  TrendingUp,
  FileText,
  Briefcase,
  Wallet,
} from 'lucide-react';

type ActivityEvent = {
  id: string;
  label: string;
  timestamp: string;
  sortAt: number;
};

const parseTimestamp = (value?: string) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const relativeTime = (value: string) => {
  const timestamp = parseTimestamp(value);
  if (!timestamp) return 'Unknown time';
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
};

export default function Dashboard() {
  const { customers, estimates, jobs, employees, timeEntries } = useStore();

  const openEstimates = estimates.filter((estimate) => estimate.status === 'draft' || estimate.status === 'sent');
  const jobsInProgress = jobs.filter((job) => job.status === 'in_progress');
  const completedJobs = jobs.filter((job) => job.status === 'completed');

  const totalRevenue = completedJobs.reduce((sum, job) => sum + job.contractValue, 0);
  const completedActualCost = completedJobs.reduce(
    (sum, job) => sum + job.actualCosts.reduce((entrySum, entry) => entrySum + entry.total, 0),
    0
  );
  const grossProfit = totalRevenue - completedActualCost;

  const allActualCost = jobs.reduce(
    (sum, job) => sum + job.actualCosts.reduce((entrySum, entry) => entrySum + entry.total, 0),
    0
  );
  const cashPosition = totalRevenue - allActualCost;

  const openEstimateValue = openEstimates.reduce((sum, estimate) => {
    const lineTotal = estimate.lineItems.reduce((lineSum, item) => lineSum + item.total, 0);
    const taxMultiplier = 1 + (estimate.taxRate ?? 0) / 100;
    return sum + lineTotal * taxMultiplier;
  }, 0);

  const upcomingJobs = useMemo(() => {
    const now = new Date();

    return jobs
      .filter((job) => {
        if (job.status !== 'scheduled' && job.status !== 'in_progress') return false;
        const start = parseTimestamp(job.startDate);
        return start > 0 && (job.status === 'in_progress' || start >= now.getTime());
      })
      .sort((a, b) => parseTimestamp(a.startDate) - parseTimestamp(b.startDate))
      .slice(0, 6);
  }, [jobs]);

  const recentActivity = useMemo(() => {
    const estimateEvents: ActivityEvent[] = estimates.map((estimate) => ({
      id: `estimate-${estimate.id}`,
      label: `Estimate ${estimate.title || estimate.id} updated`,
      timestamp: estimate.updatedAt,
      sortAt: parseTimestamp(estimate.updatedAt),
    }));

    const jobEvents: ActivityEvent[] = jobs.map((job) => ({
      id: `job-${job.id}`,
      label: `Job ${job.title || job.id} updated`,
      timestamp: job.updatedAt,
      sortAt: parseTimestamp(job.updatedAt),
    }));

    const timeEntryEvents: ActivityEvent[] = timeEntries
      .map((entry) => {
        const employee = employees.find((value) => value.id === entry.employeeId);
        const eventAt = entry.clockOut ?? entry.clockIn;
        return {
          id: `time-${entry.id}`,
          label: `${employee?.name ?? 'Employee'} ${entry.clockOut ? 'clocked out' : 'clocked in'}`,
          timestamp: eventAt,
          sortAt: parseTimestamp(eventAt),
        };
      });

    return [...estimateEvents, ...jobEvents, ...timeEntryEvents]
      .filter((event) => event.sortAt > 0)
      .sort((a, b) => b.sortAt - a.sortAt)
      .slice(0, 8);
  }, [employees, estimates, jobs, timeEntries]);

  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const activeEmployees = employees.filter((employee) => employee.active).length;
  const scheduledJobs = jobs.filter((job) => job.status === 'scheduled').length;

  return (
    <div>
      <PageHeader
        title="Company Dashboard"
        subtitle="Executive overview of business performance."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="Revenue"
          value={formatCurrency(totalRevenue)}
          icon={<DollarSign size={32} />}
          color="text-brand-700"
        />
        <StatCard
          label="Gross Profit"
          value={formatCurrency(grossProfit)}
          sub={`${grossMarginPct.toFixed(1)}% margin`}
          icon={<TrendingUp size={32} />}
          color={grossProfit >= 0 ? 'text-brand-700' : 'text-accent-700'}
        />
        <StatCard
          label="Open Estimates"
          value={openEstimates.length}
          sub={formatCurrency(openEstimateValue)}
          icon={<FileText size={32} />}
          color="text-accent-700"
        />
        <StatCard
          label="Jobs In Progress"
          value={jobsInProgress.length}
          sub={`${scheduledJobs} scheduled next`}
          icon={<Briefcase size={32} />}
          color="text-brand-600"
        />
        <StatCard
          label="Cash Position"
          value={formatCurrency(cashPosition)}
          sub="Revenue less actual job costs"
          icon={<Wallet size={32} />}
          color={cashPosition >= 0 ? 'text-brand-700' : 'text-accent-700'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <Card>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Upcoming Jobs</h2>
            <Link to="/jobs" className="text-xs text-brand-600 hover:underline">Open Operations Dashboard</Link>
          </div>
          {upcomingJobs.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">No upcoming jobs scheduled.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcomingJobs.map((job) => {
                const customer = customers.find((customerValue) => customerValue.id === job.customerId);
                return (
                  <li key={job.id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{job.title}</p>
                      <p className="text-xs text-gray-500">{customer?.name ?? 'Unassigned customer'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-700">{new Date(job.startDate).toLocaleDateString()}</p>
                      <p className="text-[11px] text-gray-500 capitalize">{job.status.replace('_', ' ')}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Recent Activity</h2>
            <Link to="/data-center" className="text-xs text-brand-600 hover:underline">Open Data Center</Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">No recent activity yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentActivity.map((event) => (
                <li key={event.id} className="p-4 flex items-start justify-between gap-4">
                  <p className="text-sm text-gray-800">{event.label}</p>
                  <p className="text-xs text-gray-500 whitespace-nowrap">{relativeTime(event.timestamp)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Financial Summary</h2>
          <Link to="/budget" className="text-xs text-brand-600 hover:underline">Open Finance Dashboard</Link>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Revenue</p>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Gross Profit</p>
            <p className={`text-xl font-semibold ${grossProfit >= 0 ? 'text-brand-700' : 'text-accent-700'}`}>
              {formatCurrency(grossProfit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Gross Margin</p>
            <p className="text-xl font-semibold text-gray-900">{grossMarginPct.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Active Workforce</p>
            <p className="text-xl font-semibold text-gray-900">{activeEmployees}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
