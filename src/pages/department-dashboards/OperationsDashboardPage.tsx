import { AlertTriangle, Briefcase, CalendarDays, Wrench } from 'lucide-react';
import DepartmentDashboard from '../../components/dashboard/DepartmentDashboard';
import { useStore } from '../../store';

export default function OperationsDashboardPage() {
  const { jobs } = useStore();

  const inProgress = jobs.filter((job) => job.status === 'in_progress');
  const scheduled = jobs.filter((job) => job.status === 'scheduled');
  const onHold = jobs.filter((job) => job.status === 'on_hold');
  const overHours = jobs.filter((job) => job.estimatedHours > 0 && job.actualHours > job.estimatedHours);

  return (
    <DepartmentDashboard
      title="Operations Dashboard"
      subtitle="Operational execution overview. Detailed planning remains in job and calendar modules."
      kpis={[
        {
          label: 'Jobs In Progress',
          value: inProgress.length,
          sub: `${scheduled.length} scheduled next`,
          icon: <Briefcase size={30} />,
          color: 'text-brand-700',
        },
        {
          label: 'On Hold',
          value: onHold.length,
          sub: 'Require follow-up',
          icon: <AlertTriangle size={30} />,
          color: 'text-accent-700',
        },
        {
          label: 'Over Estimated Hours',
          value: overHours.length,
          sub: 'Potential schedule risk',
          icon: <Wrench size={30} />,
          color: overHours.length > 0 ? 'text-accent-700' : 'text-brand-700',
        },
        {
          label: 'Total Active Queue',
          value: inProgress.length + scheduled.length,
          sub: 'In progress + scheduled',
          icon: <CalendarDays size={30} />,
          color: 'text-brand-600',
        },
      ]}
      widgets={[
        {
          title: 'Upcoming Execution Queue',
          description: 'Top jobs approaching execution windows.',
          highlights: jobs
            .filter((job) => job.status === 'scheduled' || job.status === 'in_progress')
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
            .slice(0, 5)
            .map((job) => `${job.title} • ${job.status.replace('_', ' ')} • ${job.startDate}`),
          emptyTitle: 'No upcoming operations',
          emptyDescription: 'Scheduled and active jobs will appear here.',
          actionLabel: 'Open Jobs',
          actionTo: '/jobs',
        },
        {
          title: 'Operations Workbench',
          description: 'Placeholder for equipment, inventory, and purchasing rollups.',
          emptyTitle: 'No equipment or inventory summaries yet',
          emptyDescription: 'Connect upcoming operations modules to populate this widget.',
          actionLabel: 'Open Calendar',
          actionTo: '/calendar',
        },
      ]}
    />
  );
}
