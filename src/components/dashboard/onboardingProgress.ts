import type { Customer, Employee, Estimate, Expense, Job, TimeEntry } from '../../types';

export type DashboardOnboardingItemId =
  | 'company-info'
  | 'first-employee'
  | 'first-customer'
  | 'first-estimate'
  | 'first-job'
  | 'first-clock-in'
  | 'first-expense-receipt'
  | 'first-profitability';

export type DashboardOnboardingItem = {
  id: DashboardOnboardingItemId;
  label: string;
  complete: boolean;
  to: string;
};

type BuildDashboardOnboardingItemsInput = {
  businessName?: string;
  employees: Employee[];
  customers: Customer[];
  estimates: Estimate[];
  jobs: Job[];
  timeEntries: TimeEntry[];
  expenses: Expense[];
};

function hasReceiptAttachment(expense: Expense) {
  if (typeof expense.receiptFileId === 'string' && expense.receiptFileId.trim().length > 0) return true;
  if (typeof expense.receiptUrl === 'string' && expense.receiptUrl.trim().length > 0) return true;
  return false;
}

function hasJobCostingData(jobs: Job[], timeEntries: TimeEntry[]) {
  const hasCostOrHoursOnJob = jobs.some((job) => {
    const hasActualCosts = Array.isArray(job.actualCosts)
      && job.actualCosts.some((cost) => Number.isFinite(cost.total) && cost.total > 0);
    const hasActualHours = Number.isFinite(job.actualHours) && job.actualHours > 0;
    return hasActualCosts || hasActualHours;
  });

  if (hasCostOrHoursOnJob) return true;

  return timeEntries.some((entry) => {
    if (!entry.clockIn) return false;
    const linkedJobIds = Array.isArray(entry.jobIds) && entry.jobIds.length > 0
      ? entry.jobIds
      : (entry.jobId ? [entry.jobId] : []);
    return linkedJobIds.length > 0;
  });
}

export function buildDashboardOnboardingItems({
  businessName,
  employees,
  customers,
  estimates,
  jobs,
  timeEntries,
  expenses,
}: BuildDashboardOnboardingItemsInput): DashboardOnboardingItem[] {
  return [
    {
      id: 'company-info',
      label: 'Company information completed',
      complete: typeof businessName === 'string' && businessName.trim().length > 0,
      to: '/materials/catalog',
    },
    {
      id: 'first-employee',
      label: 'First employee created',
      complete: employees.length > 0,
      to: '/employees',
    },
    {
      id: 'first-customer',
      label: 'First customer created',
      complete: customers.length > 0,
      to: '/crm',
    },
    {
      id: 'first-estimate',
      label: 'First estimate created',
      complete: estimates.length > 0,
      to: '/estimates',
    },
    {
      id: 'first-job',
      label: 'First job created',
      complete: jobs.length > 0,
      to: '/jobs',
    },
    {
      id: 'first-clock-in',
      label: 'First employee clocked in',
      complete: timeEntries.some((entry) => typeof entry.clockIn === 'string' && entry.clockIn.length > 0),
      to: '/employee-login',
    },
    {
      id: 'first-expense-receipt',
      label: 'First expense with an attached receipt uploaded',
      complete: expenses.some((expense) => hasReceiptAttachment(expense)),
      to: '/finance/expenses',
    },
    {
      id: 'first-profitability',
      label: 'First profitability/job costing data available',
      complete: hasJobCostingData(jobs, timeEntries),
      to: '/finance/profit-loss',
    },
  ];
}

export function calculateDashboardOnboardingProgress(items: DashboardOnboardingItem[]) {
  const totalCount = items.length;
  const completeCount = items.filter((item) => item.complete).length;
  const percent = totalCount === 0 ? 0 : Math.round((completeCount / totalCount) * 100);

  return {
    totalCount,
    completeCount,
    percent,
    isComplete: totalCount > 0 && completeCount === totalCount,
  };
}
