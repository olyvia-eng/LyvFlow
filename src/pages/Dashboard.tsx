import { useStore } from '../store';
import { formatCurrency, durationHours } from '../utils';
import { StatCard, Card, PageHeader } from '../components/ui';
import { Users, FileText, Briefcase, Clock, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { customers, estimates, jobs, timeEntries, employees } = useStore();

  const activeJobs = jobs.filter((j) => j.status === 'in_progress' || j.status === 'scheduled');
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const pendingEstimates = estimates.filter((e) => e.status === 'draft' || e.status === 'sent');

  const totalRevenue = completedJobs.reduce((s, j) => s + j.contractValue, 0);
  const totalActualCost = completedJobs.reduce(
    (s, j) => s + j.actualCosts.reduce((ss, c) => ss + c.total, 0),
    0
  );
  const grossProfit = totalRevenue - totalActualCost;

  const activeClockedIn = timeEntries.filter((te) => te.status === 'clocked_in');

  const totalManHoursThisMonth = timeEntries
    .filter((te) => te.status === 'clocked_out')
    .reduce((s, te) => s + durationHours(te.clockIn, te.clockOut, te.breakMinutes), 0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back — here's what's happening today."
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Active Jobs"
          value={activeJobs.length}
          sub={`${completedJobs.length} completed`}
          icon={<Briefcase size={32} />}
          color="text-blue-600"
        />
        <StatCard
          label="Clocked In Now"
          value={activeClockedIn.length}
          sub={`of ${employees.filter((e) => e.active).length} active employees`}
          icon={<Clock size={32} />}
          color="text-green-600"
        />
        <StatCard
          label="Pending Estimates"
          value={pendingEstimates.length}
          sub="draft or sent"
          icon={<FileText size={32} />}
          color="text-yellow-600"
        />
        <StatCard
          label="Total Customers"
          value={customers.length}
          sub={`${customers.filter((c) => c.status === 'active').length} active`}
          icon={<Users size={32} />}
          color="text-purple-600"
        />
      </div>

      {/* Financial row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total Revenue (Completed Jobs)"
          value={formatCurrency(totalRevenue)}
          icon={<DollarSign size={32} />}
        />
        <StatCard
          label="Gross Profit"
          value={formatCurrency(grossProfit)}
          sub={totalRevenue > 0 ? `${((grossProfit / totalRevenue) * 100).toFixed(1)}% margin` : '—'}
          icon={<TrendingUp size={32} />}
          color={grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <StatCard
          label="Man Hours Logged"
          value={`${totalManHoursThisMonth.toFixed(1)} hrs`}
          icon={<Clock size={32} />}
          color="text-blue-600"
        />
      </div>

      {/* Active Jobs table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Active Jobs</h2>
            <Link to="/jobs" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          {activeJobs.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">No active jobs.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {activeJobs.map((job) => {
                const customer = customers.find((c) => c.id === job.customerId);
                const pct = job.estimatedHours > 0 ? Math.min(100, (job.actualHours / job.estimatedHours) * 100) : 0;
                return (
                  <li key={job.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <Link to={`/jobs/${job.id}`} className="text-sm font-medium text-gray-800 hover:text-brand-600 truncate">
                        {job.title}
                      </Link>
                      <span className="text-xs text-gray-500 shrink-0 ml-2">{customer?.name ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-brand-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{job.actualHours.toFixed(1)}/{job.estimatedHours}h</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Clocked-in employees */}
        <Card>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Currently Clocked In</h2>
            <Link to="/employees" className="text-xs text-brand-600 hover:underline">Manage</Link>
          </div>
          {activeClockedIn.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">No one is clocked in right now.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {activeClockedIn.map((te) => {
                const emp = employees.find((e) => e.id === te.employeeId);
                const job = jobs.find((j) => j.id === te.jobId);
                const hrs = durationHours(te.clockIn, te.clockOut, te.breakMinutes);
                return (
                  <li key={te.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{emp?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{job?.title ?? '—'}</p>
                    </div>
                    <span className="text-sm font-semibold text-brand-600">{hrs.toFixed(1)} hrs</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Alerts */}
      {activeJobs.some((j) => j.actualHours > j.estimatedHours) && (
        <div className="mt-4 flex items-start gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 text-sm">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>
            Some jobs have exceeded their estimated hours.{' '}
            <Link to="/jobs" className="underline font-medium">Review jobs →</Link>
          </span>
        </div>
      )}
    </div>
  );
}
