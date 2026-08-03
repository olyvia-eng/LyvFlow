import { Briefcase, DollarSign, LineChart, Wallet } from 'lucide-react';
import DepartmentDashboard from '../../components/dashboard/DepartmentDashboard';
import { useStore } from '../../store';
import { formatCurrency } from '../../utils';

export default function FinanceDashboardPage() {
  const { jobs, budgetItems } = useStore();

  const completedJobs = jobs.filter((job) => job.status === 'completed');
  const revenue = completedJobs.reduce((sum, job) => sum + job.contractValue, 0);
  const directCosts = completedJobs.reduce(
    (sum, job) => sum + job.actualCosts.reduce((entrySum, entry) => entrySum + entry.total, 0),
    0
  );
  const grossProfit = revenue - directCosts;

  const budgeted = budgetItems.reduce((sum, item) => sum + item.budgeted, 0);
  const actual = budgetItems.reduce((sum, item) => sum + item.actual, 0);
  const budgetVariance = budgeted - actual;

  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  return (
    <DepartmentDashboard
      title="Finance Dashboard"
      subtitle="Executive finance summary. Detailed analysis lives in budget and reports modules."
      kpis={[
        {
          label: 'Revenue',
          value: formatCurrency(revenue),
          sub: 'Completed job value',
          icon: <DollarSign size={30} />,
          color: 'text-brand-700',
        },
        {
          label: 'Gross Profit',
          value: formatCurrency(grossProfit),
          sub: `${grossMargin.toFixed(1)}% margin`,
          icon: <LineChart size={30} />,
          color: grossProfit >= 0 ? 'text-brand-700' : 'text-accent-700',
        },
        {
          label: 'Budget Variance',
          value: formatCurrency(budgetVariance),
          sub: 'Budgeted minus actual',
          icon: <Wallet size={30} />,
          color: budgetVariance >= 0 ? 'text-brand-700' : 'text-accent-700',
        },
        {
          label: 'Tracked Jobs',
          value: jobs.length,
          sub: `${completedJobs.length} completed`,
          icon: <Briefcase size={30} />,
          color: 'text-brand-600',
        },
      ]}
      widgets={[
        {
          title: 'Financial Health Snapshot',
          description: 'Condensed directional view before drilling into finance reports.',
          highlights: [
            `Budgeted total: ${formatCurrency(budgeted)}`,
            `Actual total: ${formatCurrency(actual)}`,
            `Direct costs captured: ${formatCurrency(directCosts)}`,
          ],
          actionLabel: 'Open Company Budget',
          actionTo: '/budget',
        },
        {
          title: 'Reporting Queue',
          description: 'Finance report placeholders and handoff items.',
          emptyTitle: 'No pending report tasks',
          emptyDescription: 'Add report workflows as finance modules are expanded.',
          actionLabel: 'Open Time Reports',
          actionTo: '/time-reports',
        },
      ]}
    />
  );
}
