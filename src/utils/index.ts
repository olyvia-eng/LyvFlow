import { nanoid } from 'nanoid';

export const generateId = (): string => nanoid();

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);

export const formatDate = (iso: string): string => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (iso: string): string => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const nowISO = (): string => new Date().toISOString();

export const durationHours = (clockIn: string, clockOut?: string, breakMinutes = 0): number => {
  const start = new Date(clockIn).getTime();
  const end = clockOut ? new Date(clockOut).getTime() : Date.now();
  const ms = end - start - breakMinutes * 60_000;
  return Math.max(0, ms / 3_600_000);
};

export const calcLineItemTotal = (
  quantity: number,
  unitCost: number,
  markup: number
): number => {
  return quantity * unitCost * (1 + markup / 100);
};

export const calcEstimateSubtotal = (lineItems: { total: number }[]): number =>
  lineItems.reduce((s, li) => s + li.total, 0);

export const calcEstimateTax = (subtotal: number, taxRate: number): number =>
  subtotal * (taxRate / 100);

export const calcEstimateTotal = (subtotal: number, tax: number): number =>
  subtotal + tax;

export const statusColor: Record<string, string> = {
  // Estimate
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  converted: 'bg-purple-100 text-purple-700',
  // Job
  scheduled: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  // Customer
  lead: 'bg-gray-100 text-gray-700',
  prospect: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-red-100 text-red-700',
};
