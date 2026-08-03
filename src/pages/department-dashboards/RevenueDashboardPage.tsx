import { DollarSign, FileText, Target, Users } from 'lucide-react';
import DepartmentDashboard from '../../components/dashboard/DepartmentDashboard';
import { useStore } from '../../store';
import { formatCurrency } from '../../utils';

export default function RevenueDashboardPage() {
  const { customers, estimates, jobs } = useStore();

  const openEstimates = estimates.filter((estimate) => estimate.status === 'draft' || estimate.status === 'sent');
  const convertedEstimates = estimates.filter((estimate) => estimate.status === 'converted' || estimate.status === 'accepted');

  const openEstimateValue = openEstimates.reduce((sum, estimate) => {
    const lineTotal = estimate.lineItems.reduce((lineSum, item) => lineSum + item.total, 0);
    return sum + lineTotal * (1 + (estimate.taxRate ?? 0) / 100);
  }, 0);

  const totalEstimateCount = estimates.length;
  const conversionRate = totalEstimateCount > 0 ? (convertedEstimates.length / totalEstimateCount) * 100 : 0;
  const activeClientCount = customers.filter((customer) => customer.status === 'active').length;
  const wonRevenue = jobs
    .filter((job) => job.status === 'completed')
    .reduce((sum, job) => sum + job.contractValue, 0);

  return (
    <DepartmentDashboard
      title="Revenue Dashboard"
      subtitle="High-level sales and pipeline metrics for leadership review."
      kpis={[
        {
          label: 'Open Pipeline',
          value: formatCurrency(openEstimateValue),
          sub: `${openEstimates.length} open estimates`,
          icon: <Target size={30} />,
          color: 'text-accent-700',
        },
        {
          label: 'Won Revenue',
          value: formatCurrency(wonRevenue),
          sub: 'Completed jobs value',
          icon: <DollarSign size={30} />,
          color: 'text-brand-700',
        },
        {
          label: 'Conversion Rate',
          value: `${conversionRate.toFixed(1)}%`,
          sub: `${convertedEstimates.length} won of ${totalEstimateCount}`,
          icon: <FileText size={30} />,
          color: 'text-accent-700',
        },
        {
          label: 'Active Clients',
          value: activeClientCount,
          sub: `${customers.length} total customer records`,
          icon: <Users size={30} />,
          color: 'text-brand-600',
        },
      ]}
      widgets={[
        {
          title: 'Pipeline Snapshot',
          description: 'Top-level pipeline health. Detailed deal stages belong in Revenue tools.',
          highlights: openEstimates.slice(0, 4).map((estimate) => `${estimate.title} • ${estimate.status}`),
          emptyTitle: 'No pipeline items',
          emptyDescription: 'Create estimates to populate the pipeline snapshot.',
          actionLabel: 'Open Estimates',
          actionTo: '/estimates',
        },
        {
          title: 'Revenue Signals',
          description: 'Quick directional indicators for executive review.',
          highlights: [
            `Open estimate value: ${formatCurrency(openEstimateValue)}`,
            `Converted estimates: ${convertedEstimates.length}`,
            `Average estimate size: ${formatCurrency(totalEstimateCount > 0 ? openEstimateValue / Math.max(openEstimates.length, 1) : 0)}`,
          ],
          actionLabel: 'Open CRM',
          actionTo: '/crm',
        },
      ]}
    />
  );
}
