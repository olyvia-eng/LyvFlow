import { Clock, UserCheck, Wallet } from 'lucide-react';
import DepartmentDashboard from '../../components/dashboard/DepartmentDashboard';
import { useStore } from '../../store';
import { durationHours, formatCurrency } from '../../utils';

export default function EmployeesDashboardPage() {
  const { employees, timeEntries } = useStore();

  const activeEmployees = employees.filter((employee) => employee.active);
  const clockedInNow = timeEntries.filter((entry) => entry.status === 'clocked_in');

  const completedHours = timeEntries
    .filter((entry) => entry.status === 'clocked_out')
    .reduce((sum, entry) => sum + durationHours(entry.clockIn, entry.clockOut, entry.breakMinutes), 0);

  const averageRate = activeEmployees.length > 0
    ? activeEmployees.reduce((sum, employee) => sum + employee.hourlyRate, 0) / activeEmployees.length
    : 0;

  return (
    <DepartmentDashboard
      title="Employees Dashboard"
      subtitle="Workforce summary for leadership. Detailed HR and payroll live in employee modules."
      kpis={[
        {
          label: 'Active Employees',
          value: activeEmployees.length,
          sub: `${employees.length} total records`,
          icon: <UserCheck size={30} />,
          color: 'text-brand-600',
        },
        {
          label: 'Clocked In Now',
          value: clockedInNow.length,
          sub: 'Current active shifts',
          icon: <Clock size={30} />,
          color: 'text-brand-700',
        },
        {
          label: 'Hours Logged',
          value: `${completedHours.toFixed(1)} hrs`,
          sub: 'Closed time entries',
          icon: <Clock size={30} />,
          color: 'text-accent-700',
        },
        {
          label: 'Average Hourly Rate',
          value: formatCurrency(averageRate),
          sub: 'Active employee average',
          icon: <Wallet size={30} />,
          color: 'text-accent-700',
        },
      ]}
      widgets={[
        {
          title: 'Workforce Status',
          description: 'Operational workforce visibility for leadership.',
          highlights: [
            `${clockedInNow.length} currently clocked in`,
            `${activeEmployees.length} active employees`,
            `${timeEntries.length} total time entries on record`,
          ],
          actionLabel: 'Open Employees',
          actionTo: '/employees',
        },
        {
          title: 'Compliance & Certifications',
          description: 'Placeholder for certification and compliance status rollups.',
          emptyTitle: 'No certification data connected yet',
          emptyDescription: 'Employee certification tracking will surface here once implemented.',
          actionLabel: 'Open Time Reports',
          actionTo: '/time-reports',
        },
      ]}
    />
  );
}
