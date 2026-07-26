import { useStore } from '../../store';
import { PageHeader, Card, StatCard } from '../../components/ui';
import { formatCurrency, durationHours } from '../../utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { DollarSign, Clock, TrendingUp, Briefcase, Users, BarChart3 } from 'lucide-react';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function DataCenterPage() {
  const { jobs, customers, estimates, timeEntries, budgetItems } = useStore();

  // ── Job metrics ────────────────────────────────────────────────────────────
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const activeJobs = jobs.filter((j) => j.status === 'in_progress' || j.status === 'scheduled');

  const totalRevenue = completedJobs.reduce((s, j) => s + j.contractValue, 0);
  const totalActualCost = completedJobs.reduce(
    (s, j) => s + j.actualCosts.reduce((ss, c) => ss + c.total, 0),
    0
  );
  const grossProfit = totalRevenue - totalActualCost;
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // Man hours (all completed entries)
  const completedEntries = timeEntries.filter((te) => te.status === 'clocked_out');
  const totalManHours = completedEntries.reduce(
    (s, te) => s + durationHours(te.clockIn, te.clockOut, te.breakMinutes),
    0
  );

  // Hours sold vs estimated
  const totalEstimatedHours = jobs.reduce((s, j) => s + j.estimatedHours, 0);
  const totalActualHours = jobs.reduce((s, j) => s + j.actualHours, 0);

  // Revenue per man-hour (throughput)
  const revenuePerHour = totalManHours > 0 ? totalRevenue / totalManHours : 0;

  // ── Charts data ────────────────────────────────────────────────────────────

  // Jobs by status
  const jobsByStatus = ['scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled'].map((s) => ({
    name: s.replace(/_/g, ' '),
    count: jobs.filter((j) => j.status === s).length,
  }));

  // Active jobs: estimated vs actual hours
  const hoursComparison = [...activeJobs, ...completedJobs].slice(0, 8).map((j) => ({
    name: j.title.length > 20 ? j.title.slice(0, 18) + '…' : j.title,
    estimated: j.estimatedHours,
    actual: j.actualHours,
  }));

  // Budget: budgeted vs actual per category
  const budgetByCategory = Array.from(
    new Set(budgetItems.map((b) => b.category))
  ).map((cat) => {
    const items = budgetItems.filter((b) => b.category === cat);
    return {
      name: cat,
      budgeted: items.reduce((s, b) => s + b.budgeted, 0),
      actual: items.reduce((s, b) => s + b.actual, 0),
    };
  });

  // Cost breakdown for completed jobs
  const costByCategory = ['labour', 'material', 'equipment', 'subcontractor'].map((cat) => ({
    name: cat,
    value: completedJobs.reduce(
      (s, j) => s + j.actualCosts.filter((c) => c.category === cat).reduce((ss, c) => ss + c.total, 0),
      0
    ),
  })).filter((d) => d.value > 0);

  // Estimates funnel
  const estimateFunnel = ['draft', 'sent', 'accepted', 'declined', 'converted'].map((s) => ({
    name: s,
    count: estimates.filter((e) => e.status === s).length,
  }));

  // Customer status breakdown
  const customersByStatus = ['lead', 'prospect', 'active', 'inactive'].map((s) => ({
    name: s,
    count: customers.filter((c) => c.status === s).length,
  }));

  return (
    <div>
      <PageHeader
        title="Data Center"
        subtitle="Key metrics and performance indicators for your business."
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={<DollarSign size={32} />} />
        <StatCard
          label="Gross Profit"
          value={formatCurrency(grossProfit)}
          sub={`${grossMarginPct.toFixed(1)}% margin`}
          icon={<TrendingUp size={32} />}
          color={grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <StatCard label="Man Hours Logged" value={`${totalManHours.toFixed(1)} hrs`} sub={`${totalEstimatedHours} estimated`} icon={<Clock size={32} />} color="text-blue-600" />
        <StatCard label="Revenue / Man Hour" value={formatCurrency(revenuePerHour)} sub="Throughput" icon={<BarChart3 size={32} />} color="text-purple-600" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Completed Jobs" value={completedJobs.length} icon={<Briefcase size={32} />} color="text-green-600" />
        <StatCard label="Active Jobs" value={activeJobs.length} icon={<Briefcase size={32} />} color="text-blue-600" />
        <StatCard label="Hours Sold (est.)" value={`${totalEstimatedHours} hrs`} sub={`Actual: ${totalActualHours} hrs`} icon={<Clock size={32} />} />
        <StatCard label="Customers" value={customers.length} sub={`${customers.filter((c) => c.status === 'active').length} active`} icon={<Users size={32} />} color="text-orange-600" />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hours: estimated vs actual */}
        <Card className="p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Man Hours: Estimated vs Actual</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hoursComparison} barGap={4}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="estimated" fill="#93c5fd" radius={[4,4,0,0]} name="Estimated" />
              <Bar dataKey="actual" fill="#22c55e" radius={[4,4,0,0]} name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Cost breakdown pie */}
        <Card className="p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Cost Breakdown (Completed Jobs)</h2>
          {costByCategory.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No cost data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={costByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {costByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Budget chart */}
        <Card className="p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Budget: Budgeted vs Actual</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={budgetByCategory}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              <Bar dataKey="budgeted" fill="#93c5fd" radius={[4,4,0,0]} name="Budgeted" />
              <Bar dataKey="actual" fill="#f59e0b" radius={[4,4,0,0]} name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Jobs by status */}
        <Card className="p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Jobs by Status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={jobsByStatus} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Bar dataKey="count" fill="#22c55e" radius={[0,4,4,0]} name="Jobs" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Estimate funnel */}
        <Card className="p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Estimate Pipeline</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={estimateFunnel}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4,4,0,0]} name="Estimates" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Customer breakdown */}
        <Card className="p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Customers by Status</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={customersByStatus.filter((d) => d.count > 0)} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name} (${value})`}>
                {customersByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Metrics table */}
      <Card className="mt-6 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Job Performance Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-left text-xs">
                <th className="px-4 py-2 font-medium">Job</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Contract</th>
                <th className="px-4 py-2 font-medium text-right">Actual Cost</th>
                <th className="px-4 py-2 font-medium text-right">Profit</th>
                <th className="px-4 py-2 font-medium text-right">Margin</th>
                <th className="px-4 py-2 font-medium text-right">Est. Hrs</th>
                <th className="px-4 py-2 font-medium text-right">Act. Hrs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.map((j) => {
                const cost = j.actualCosts.reduce((s, c) => s + c.total, 0);
                const profit = j.contractValue - cost;
                const margin = j.contractValue > 0 ? (profit / j.contractValue) * 100 : 0;
                return (
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium truncate max-w-xs">{j.title}</td>
                    <td className="px-4 py-2 capitalize text-gray-500">{j.status.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(j.contractValue)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(cost)}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(profit)}
                    </td>
                    <td className={`px-4 py-2 text-right ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {margin.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500">{j.estimatedHours}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${j.actualHours > j.estimatedHours ? 'text-red-500' : 'text-gray-800'}`}>
                      {j.actualHours.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
