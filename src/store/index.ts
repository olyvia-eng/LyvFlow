import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Customer,
  Estimate,
  EstimateTemplate,
  Job,
  Employee,
  TimeEntry,
  TimeEntryWorkType,
  BudgetItem,
  LineItem,
  CostEntry,
  ID,
} from '../types';
import {
  generateId,
  nowISO,
  calcLineItemTotal,
  calcEstimateSubtotal,
} from '../utils';
import { emitAppToast } from '../toast';

// ─── Seed data helpers ────────────────────────────────────────────────────────

const SEED_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    name: 'Alice Johnson',
    company: 'Green Thumb Properties',
    email: 'alice@greenthumb.ca',
    phone: '(613) 555-0101',
    address: { street: '123 Maple St', city: 'Ottawa', province: 'ON', postalCode: 'K1A 0B1', country: 'Canada' },
    status: 'active',
    notes: 'Prefers morning appointments.',
    tags: ['residential', 'landscaping'],
    createdAt: '2025-01-10T10:00:00.000Z',
    updatedAt: '2025-01-10T10:00:00.000Z',
  },
  {
    id: 'c2',
    name: 'Bob Martinez',
    company: 'Stonework Developments',
    email: 'bob@stonework.ca',
    phone: '(613) 555-0202',
    address: { street: '456 Oak Ave', city: 'Gatineau', province: 'QC', postalCode: 'J8Y 3J2', country: 'Canada' },
    status: 'prospect',
    notes: 'Interested in full property renovation.',
    tags: ['commercial', 'construction'],
    createdAt: '2025-02-15T09:00:00.000Z',
    updatedAt: '2025-02-15T09:00:00.000Z',
  },
  {
    id: 'c3',
    name: 'Carol White',
    company: '',
    email: 'carol.white@email.com',
    phone: '(613) 555-0303',
    address: { street: '789 Pine Rd', city: 'Ottawa', province: 'ON', postalCode: 'K2B 5N4', country: 'Canada' },
    status: 'lead',
    notes: '',
    tags: ['residential'],
    createdAt: '2025-03-01T14:00:00.000Z',
    updatedAt: '2025-03-01T14:00:00.000Z',
  },
];

const SEED_EMPLOYEES: Employee[] = [
  { id: 'e1', name: 'Dan Foreman', email: 'dan@oliveops.ca', phone: '(613) 555-1001', role: 'foreman', hourlyRate: 45, active: true, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'e2', name: 'Eva Crew', email: 'eva@oliveops.ca', phone: '(613) 555-1002', role: 'crew_member', hourlyRate: 32, active: true, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'e3', name: 'Frank Worker', email: 'frank@oliveops.ca', phone: '(613) 555-1003', role: 'crew_member', hourlyRate: 30, active: true, createdAt: '2025-01-01T00:00:00.000Z' },
];

const SEED_TEMPLATES: EstimateTemplate[] = [
  {
    id: 't1',
    name: 'Lawn Maintenance Package',
    description: 'Standard residential lawn care estimate.',
    lineItems: [
      { category: 'labour', description: 'Mowing & Edging', quantity: 4, unit: 'hr', unitCost: 35, markup: 0, total: 140 },
      { category: 'material', description: 'Fertilizer (25kg bag)', quantity: 2, unit: 'bag', unitCost: 45, markup: 15, total: 103.5 },
    ],
    taxRate: 13,
    notes: 'Recurring bi-weekly service.',
    createdAt: '2025-01-05T08:00:00.000Z',
  },
  {
    id: 't2',
    name: 'Interlock Driveway',
    description: 'Interlock stone driveway installation.',
    lineItems: [
      { category: 'labour', description: 'Excavation & Grading', quantity: 16, unit: 'hr', unitCost: 55, markup: 10, total: 968 },
      { category: 'material', description: 'Interlock Stone', quantity: 80, unit: 'sqft', unitCost: 12, markup: 20, total: 1152 },
      { category: 'material', description: 'Gravel Base', quantity: 10, unit: 'ton', unitCost: 45, markup: 10, total: 495 },
      { category: 'equipment', description: 'Plate Compactor Rental', quantity: 2, unit: 'day', unitCost: 150, markup: 0, total: 300 },
    ],
    taxRate: 13,
    notes: 'Includes 2-year workmanship warranty.',
    createdAt: '2025-01-05T08:00:00.000Z',
  },
];

const li = (id: string, cat: LineItem['category'], desc: string, qty: number, unit: string, cost: number, markup: number): LineItem => ({
  id, category: cat, description: desc, quantity: qty, unit, unitCost: cost, markup, total: calcLineItemTotal(qty, cost, markup),
});

const SEED_ESTIMATES: Estimate[] = [
  {
    id: 'est1',
    customerId: 'c1',
    title: 'Spring Cleanup & Lawn Maintenance',
    description: 'Full spring cleanup including debris removal, lawn fertilizing, and edging.',
    status: 'accepted',
    lineItems: [
      li('li1', 'labour', 'Spring Cleanup Labour', 8, 'hr', 40, 10),
      li('li2', 'material', 'Fertilizer', 3, 'bag', 45, 15),
      li('li3', 'equipment', 'Debris Removal Truck', 1, 'day', 200, 0),
    ],
    taxRate: 13,
    notes: 'Customer prefers Saturday morning work.',
    validUntil: '2025-04-30T00:00:00.000Z',
    createdAt: '2025-03-15T10:00:00.000Z',
    updatedAt: '2025-03-15T10:00:00.000Z',
    sentAt: '2025-03-16T10:00:00.000Z',
  },
  {
    id: 'est2',
    customerId: 'c2',
    title: 'Interlock Driveway Installation',
    description: 'Full interlock driveway replacement.',
    status: 'converted',
    lineItems: [
      li('li4', 'labour', 'Excavation & Grading', 16, 'hr', 55, 10),
      li('li5', 'material', 'Interlock Stone (Holland Cobble)', 80, 'sqft', 14, 20),
      li('li6', 'material', 'Gravel Base (3/4 clear)', 10, 'ton', 50, 10),
      li('li7', 'equipment', 'Plate Compactor Rental', 2, 'day', 150, 0),
      li('li8', 'subcontractor', 'Concrete Cutting', 1, 'job', 600, 0),
    ],
    taxRate: 13,
    notes: 'Start date TBD pending permit.',
    validUntil: '2025-05-15T00:00:00.000Z',
    createdAt: '2025-03-20T09:00:00.000Z',
    updatedAt: '2025-03-20T09:00:00.000Z',
    sentAt: '2025-03-21T09:00:00.000Z',
  },
  {
    id: 'est3',
    customerId: 'c3',
    title: 'Backyard Landscaping Design & Install',
    description: 'New planting beds, sod, and retaining wall.',
    status: 'draft',
    lineItems: [
      li('li9', 'labour', 'Design & Planning', 4, 'hr', 65, 0),
      li('li10', 'labour', 'Installation Labour', 24, 'hr', 45, 10),
      li('li11', 'material', 'Sod (Bluegrass)', 500, 'sqft', 0.85, 20),
      li('li12', 'material', 'Perennial Plants', 20, 'unit', 25, 20),
      li('li13', 'material', 'Retaining Wall Block', 60, 'unit', 8, 15),
    ],
    taxRate: 13,
    notes: '',
    validUntil: '2025-06-01T00:00:00.000Z',
    createdAt: '2025-04-01T11:00:00.000Z',
    updatedAt: '2025-04-01T11:00:00.000Z',
  },
];

const ce = (id: string, cat: CostEntry['category'], desc: string, qty: number, unit: string, cost: number, date: string): CostEntry => ({
  id, category: cat, description: desc, quantity: qty, unit, unitCost: cost, total: qty * cost, date,
});

const SEED_JOBS: Job[] = [
  {
    id: 'j1',
    estimateId: 'est1',
    customerId: 'c1',
    title: 'Spring Cleanup & Lawn Maintenance – Alice Johnson',
    description: 'Full spring cleanup including debris removal, lawn fertilizing, and edging.',
    status: 'completed',
    startDate: '2025-04-05T08:00:00.000Z',
    endDate: '2025-04-05T16:00:00.000Z',
    estimatedHours: 8,
    actualHours: 9.5,
    estimatedCost: calcEstimateSubtotal(SEED_ESTIMATES[0].lineItems),
    actualCosts: [
      ce('ac1', 'labour', 'Spring Cleanup Labour', 9.5, 'hr', 40, '2025-04-05'),
      ce('ac2', 'material', 'Fertilizer', 3, 'bag', 45, '2025-04-05'),
      ce('ac3', 'equipment', 'Debris Removal Truck', 1, 'day', 200, '2025-04-05'),
    ],
    contractValue: 880,
    assignedEmployeeIds: ['e1', 'e2'],
    notes: '',
    createdAt: '2025-04-01T08:00:00.000Z',
    updatedAt: '2025-04-05T16:30:00.000Z',
  },
  {
    id: 'j2',
    estimateId: 'est2',
    customerId: 'c2',
    title: 'Interlock Driveway – Stonework Developments',
    description: 'Full interlock driveway replacement.',
    status: 'in_progress',
    startDate: '2025-05-12T07:00:00.000Z',
    estimatedHours: 40,
    actualHours: 22,
    estimatedCost: calcEstimateSubtotal(SEED_ESTIMATES[1].lineItems),
    actualCosts: [
      ce('ac4', 'labour', 'Day 1 – Excavation', 12, 'hr', 55, '2025-05-12'),
      ce('ac5', 'material', 'Gravel Base delivery', 10, 'ton', 50, '2025-05-12'),
      ce('ac6', 'equipment', 'Plate Compactor Day 1', 1, 'day', 150, '2025-05-12'),
      ce('ac7', 'labour', 'Day 2 – Stone Laying', 10, 'hr', 55, '2025-05-13'),
    ],
    contractValue: 4800,
    assignedEmployeeIds: ['e1', 'e2', 'e3'],
    notes: 'Waiting on final stone delivery for border.',
    createdAt: '2025-05-01T09:00:00.000Z',
    updatedAt: '2025-05-13T17:00:00.000Z',
  },
];

const SEED_TIME_ENTRIES: TimeEntry[] = [
  { id: 'te1', employeeId: 'e1', jobId: 'j1', jobIds: ['j1'], workType: 'job', clockIn: '2025-04-05T08:00:00.000Z', clockOut: '2025-04-05T16:30:00.000Z', breakMinutes: 30, notes: '', status: 'clocked_out' },
  { id: 'te2', employeeId: 'e2', jobId: 'j1', jobIds: ['j1'], workType: 'job', clockIn: '2025-04-05T08:00:00.000Z', clockOut: '2025-04-05T16:00:00.000Z', breakMinutes: 30, notes: '', status: 'clocked_out' },
  { id: 'te3', employeeId: 'e1', jobId: 'j2', jobIds: ['j2'], workType: 'job', clockIn: '2025-05-12T07:00:00.000Z', clockOut: '2025-05-12T15:00:00.000Z', breakMinutes: 30, notes: '', status: 'clocked_out' },
  { id: 'te4', employeeId: 'e2', jobId: 'j2', jobIds: ['j2'], workType: 'job', clockIn: '2025-05-12T07:00:00.000Z', clockOut: '2025-05-12T15:00:00.000Z', breakMinutes: 30, notes: '', status: 'clocked_out' },
  { id: 'te5', employeeId: 'e3', jobId: 'j2', jobIds: ['j2'], workType: 'job', clockIn: '2025-05-12T07:00:00.000Z', clockOut: '2025-05-12T14:30:00.000Z', breakMinutes: 30, notes: '', status: 'clocked_out' },
];

const SEED_BUDGET: BudgetItem[] = [
  { id: 'b1', category: 'revenue', description: 'Residential Landscaping Revenue', budgeted: 80000, actual: 45000, period: '2025-05' },
  { id: 'b2', category: 'labour', description: 'Field Labour Wages', budgeted: 30000, actual: 18500, period: '2025-05' },
  { id: 'b3', category: 'materials', description: 'Materials & Supplies', budgeted: 12000, actual: 8200, period: '2025-05' },
  { id: 'b4', category: 'equipment', description: 'Equipment Rentals & Fuel', budgeted: 5000, actual: 3100, period: '2025-05' },
  { id: 'b5', category: 'subcontractors', description: 'Subcontractor Costs', budgeted: 8000, actual: 3600, period: '2025-05' },
  { id: 'b6', category: 'overhead', description: 'Office & Admin Overhead', budgeted: 4000, actual: 3800, period: '2025-05' },
  { id: 'b7', category: 'insurance', description: 'Liability Insurance', budgeted: 1500, actual: 1500, period: '2025-05' },
  { id: 'b8', category: 'marketing', description: 'Marketing & Advertising', budgeted: 2000, actual: 900, period: '2025-05' },
];

async function ensureOk(responsePromise: Promise<Response>) {
  const response = await responsePromise;
  if (!response.ok) {
    let detail = '';
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload?.error === 'string') {
        detail = payload.error;
      }
    } catch {
      // Ignore response parse errors; use status fallback.
    }

    if (!detail) {
      if (response.status === 401) detail = 'Unauthorized. Please log in again.';
      else if (response.status === 403) detail = 'Forbidden. Only owner/admin can change customer data.';
      else detail = `Request failed with status ${response.status}`;
    }

    throw new Error(detail);
  }
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function dataUrl(entity: string, id?: string) {
  const query = id ? `?entity=${entity}&id=${id}` : `?entity=${entity}`;
  return `/api/data${query}`;
}

// ─── Store definition ─────────────────────────────────────────────────────────

interface AppState {
  customers: Customer[];
  estimates: Estimate[];
  templates: EstimateTemplate[];
  jobs: Job[];
  employees: Employee[];
  timeEntries: TimeEntry[];
  budgetItems: BudgetItem[];

  // CRM
  addCustomer: (c: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCustomer: (id: ID, data: Partial<Customer>) => void;
  deleteCustomer: (id: ID) => void;

  // Estimates
  addEstimate: (e: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEstimate: (id: ID, data: Partial<Estimate>) => void;
  deleteEstimate: (id: ID) => void;
  sendEstimate: (id: ID) => void;
  convertEstimateToJob: (estimateId: ID) => void;

  // Templates
  addTemplate: (t: Omit<EstimateTemplate, 'id' | 'createdAt'>) => void;
  updateTemplate: (id: ID, data: Partial<EstimateTemplate>) => void;
  deleteTemplate: (id: ID) => void;

  // Jobs
  addJob: (j: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateJob: (id: ID, data: Partial<Job>) => void;
  deleteJob: (id: ID) => void;
  addCostEntry: (jobId: ID, entry: Omit<CostEntry, 'id'>) => void;

  // Employees
  addEmployee: (e: Omit<Employee, 'id' | 'createdAt'>) => void;
  updateEmployee: (id: ID, data: Partial<Employee>) => void;
  deleteEmployee: (id: ID) => void;

  // Time Entries
  clockIn: (employeeId: ID, options: { workType: TimeEntryWorkType; jobIds?: ID[] }) => void;
  clockOut: (entryId: ID, breakMinutes?: number, notes?: string) => void;
  addTimeEntry: (e: Omit<TimeEntry, 'id'>) => void;
  deleteTimeEntry: (id: ID) => void;

  // Budget
  addBudgetItem: (item: Omit<BudgetItem, 'id'>) => void;
  updateBudgetItem: (id: ID, data: Partial<BudgetItem>) => void;
  deleteBudgetItem: (id: ID) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      customers: SEED_CUSTOMERS,
      estimates: SEED_ESTIMATES,
      templates: SEED_TEMPLATES,
      jobs: SEED_JOBS,
      employees: SEED_EMPLOYEES,
      timeEntries: SEED_TIME_ENTRIES,
      budgetItems: SEED_BUDGET,

      // ── CRM ──────────────────────────────────────────────────────────────
      addCustomer: (c) => {
        const previous = get().customers;
        const customer = { ...c, id: generateId(), createdAt: nowISO(), updatedAt: nowISO() };
        set((s) => ({
          customers: [...s.customers, customer],
        }));

        void ensureOk(fetch(dataUrl('customers'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: customer }),
        })).catch((error: unknown) => {
          set({ customers: previous });
          emitAppToast({ tone: 'error', message: errorMessage(error, 'Customer could not be saved.') });
        });
      },
      updateCustomer: (id, data) => {
        const previous = get().customers;
        const updatedAt = nowISO();
        set((s) => ({
          customers: s.customers.map((c) =>
            c.id === id ? { ...c, ...data, updatedAt } : c
          ),
        }));

        void ensureOk(fetch(dataUrl('customers', id), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: { ...data, updatedAt } }),
        })).catch((error: unknown) => {
          set({ customers: previous });
          emitAppToast({ tone: 'error', message: errorMessage(error, 'Customer changes could not be saved.') });
        });
      },
      deleteCustomer: (id) => {
        const previous = get().customers;
        set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }));

        void ensureOk(fetch(dataUrl('customers', id), {
          method: 'DELETE',
          credentials: 'include',
        })).catch((error: unknown) => {
          set({ customers: previous });
          emitAppToast({ tone: 'error', message: errorMessage(error, 'Customer could not be deleted.') });
        });
      },

      // ── Estimates ─────────────────────────────────────────────────────────
      addEstimate: (e) => {
        const previous = get().estimates;
        const estimate = { ...e, id: generateId(), createdAt: nowISO(), updatedAt: nowISO() };
        set((s) => ({ estimates: [...s.estimates, estimate] }));

        void ensureOk(fetch(dataUrl('estimates'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: estimate }),
        })).catch(() => {
          set({ estimates: previous });
          emitAppToast({ tone: 'error', message: 'Estimate could not be saved.' });
        });
      },
      updateEstimate: (id, data) => {
        const previous = get().estimates;
        const updatedAt = nowISO();
        set((s) => ({
          estimates: s.estimates.map((e) =>
            e.id === id ? { ...e, ...data, updatedAt } : e
          ),
        }));

        void ensureOk(fetch(dataUrl('estimates', id), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: { ...data, updatedAt } }),
        })).catch(() => {
          set({ estimates: previous });
          emitAppToast({ tone: 'error', message: 'Estimate changes could not be saved.' });
        });
      },
      deleteEstimate: (id) => {
        const previous = get().estimates;
        set((s) => ({ estimates: s.estimates.filter((e) => e.id !== id) }));

        void ensureOk(fetch(dataUrl('estimates', id), {
          method: 'DELETE',
          credentials: 'include',
        })).catch(() => {
          set({ estimates: previous });
          emitAppToast({ tone: 'error', message: 'Estimate could not be deleted.' });
        });
      },
      sendEstimate: (id) => {
        const previous = get().estimates;
        const sentAt = nowISO();
        const updatedAt = sentAt;
        set((s) => ({
          estimates: s.estimates.map((e) =>
            e.id === id ? { ...e, status: 'sent', sentAt, updatedAt } : e
          ),
        }));

        void ensureOk(fetch(dataUrl('estimates', id), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: { status: 'sent', sentAt, updatedAt } }),
        })).catch(() => {
          set({ estimates: previous });
          emitAppToast({ tone: 'error', message: 'Estimate status could not be updated.' });
        });
      },
      convertEstimateToJob: (estimateId) => {
        const { estimates } = get();
        const previousEstimates = estimates;
        const previousJobs = get().jobs;
        const est = estimates.find((e) => e.id === estimateId);
        if (!est) return;
        const subtotal = est.lineItems.reduce((s, li) => s + li.total, 0);
        const tax = subtotal * (est.taxRate / 100);
        const contractValue = subtotal + tax;
        const newJob: Job = {
          id: generateId(),
          estimateId,
          customerId: est.customerId,
          title: est.title,
          description: est.description,
          status: 'scheduled',
          startDate: nowISO(),
          estimatedHours: est.lineItems
            .filter((li) => li.category === 'labour')
            .reduce((s, li) => s + li.quantity, 0),
          actualHours: 0,
          estimatedCost: subtotal,
          actualCosts: [],
          contractValue,
          assignedEmployeeIds: [],
          notes: est.notes,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        };
        set((s) => ({
          jobs: [...s.jobs, newJob],
          estimates: s.estimates.map((e) =>
            e.id === estimateId
              ? { ...e, status: 'converted', updatedAt: nowISO() }
              : e
          ),
        }));

        void Promise.all([
          ensureOk(fetch(dataUrl('jobs'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ data: newJob }),
          })),
          ensureOk(fetch(dataUrl('estimates', estimateId), {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ data: { status: 'converted', updatedAt: nowISO() } }),
          })),
        ]).catch(() => {
          set({ estimates: previousEstimates, jobs: previousJobs });
          emitAppToast({ tone: 'error', message: 'Estimate could not be converted to a job.' });
        });
      },

      // ── Templates ─────────────────────────────────────────────────────────
      addTemplate: (t) => {
        const previous = get().templates;
        const template = { ...t, id: generateId(), createdAt: nowISO() };
        set((s) => ({
          templates: [...s.templates, template],
        }));

        void ensureOk(fetch(dataUrl('templates'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: template }),
        })).catch(() => {
          set({ templates: previous });
          emitAppToast({ tone: 'error', message: 'Template could not be saved.' });
        });
      },
      updateTemplate: (id, data) => {
        const previous = get().templates;
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id ? { ...t, ...data } : t
          ),
        }));

        void ensureOk(fetch(dataUrl('templates', id), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data }),
        })).catch(() => {
          set({ templates: previous });
          emitAppToast({ tone: 'error', message: 'Template changes could not be saved.' });
        });
      },
      deleteTemplate: (id) => {
        const previous = get().templates;
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));

        void ensureOk(fetch(dataUrl('templates', id), {
          method: 'DELETE',
          credentials: 'include',
        })).catch(() => {
          set({ templates: previous });
          emitAppToast({ tone: 'error', message: 'Template could not be deleted.' });
        });
      },

      // ── Jobs ──────────────────────────────────────────────────────────────
      addJob: (j) => {
        const previous = get().jobs;
        const job = { ...j, id: generateId(), createdAt: nowISO(), updatedAt: nowISO() };
        set((s) => ({
          jobs: [...s.jobs, job],
        }));

        void ensureOk(fetch(dataUrl('jobs'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: job }),
        })).catch(() => {
          set({ jobs: previous });
          emitAppToast({ tone: 'error', message: 'Job could not be saved.' });
        });
      },
      updateJob: (id, data) => {
        const previous = get().jobs;
        const updatedAt = nowISO();
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id ? { ...j, ...data, updatedAt } : j
          ),
        }));

        void ensureOk(fetch(dataUrl('jobs', id), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: { ...data, updatedAt } }),
        })).catch(() => {
          set({ jobs: previous });
          emitAppToast({ tone: 'error', message: 'Job changes could not be saved.' });
        });
      },
      deleteJob: (id) => {
        const previous = get().jobs;
        set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));

        void ensureOk(fetch(dataUrl('jobs', id), {
          method: 'DELETE',
          credentials: 'include',
        })).catch(() => {
          set({ jobs: previous });
          emitAppToast({ tone: 'error', message: 'Job could not be deleted.' });
        });
      },
      addCostEntry: (jobId, entry) => {
        const previous = get().jobs;
        const id = generateId();
        const updatedAt = nowISO();
        let nextJob: Job | null = null;

        set((s) => ({
          jobs: s.jobs.map((j) => {
            if (j.id !== jobId) return j;

            nextJob = {
              ...j,
              actualCosts: [...j.actualCosts, { ...entry, id }],
              updatedAt,
            };

            return nextJob;
          }),
        }));

        if (!nextJob) return;

        void ensureOk(fetch(dataUrl('jobs', jobId), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: nextJob }),
        })).catch(() => {
          set({ jobs: previous });
          emitAppToast({ tone: 'error', message: 'Cost entry could not be saved.' });
        });
      },

      // ── Employees ─────────────────────────────────────────────────────────
      addEmployee: (e) => {
        const previous = get().employees;
        const employee = { ...e, id: generateId(), createdAt: nowISO() };
        set((s) => ({ employees: [...s.employees, employee] }));

        void ensureOk(fetch(dataUrl('employees'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: employee }),
        })).catch(() => {
          set({ employees: previous });
          emitAppToast({ tone: 'error', message: 'Employee could not be saved.' });
        });
      },
      updateEmployee: (id, data) => {
        const previous = get().employees;
        set((s) => ({
          employees: s.employees.map((e) =>
            e.id === id ? { ...e, ...data } : e
          ),
        }));

        void ensureOk(fetch(dataUrl('employees', id), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data }),
        })).catch(() => {
          set({ employees: previous });
          emitAppToast({ tone: 'error', message: 'Employee changes could not be saved.' });
        });
      },
      deleteEmployee: (id) => {
        const previous = get().employees;
        set((s) => ({ employees: s.employees.filter((e) => e.id !== id) }));

        void ensureOk(fetch(dataUrl('employees', id), {
          method: 'DELETE',
          credentials: 'include',
        })).catch(() => {
          set({ employees: previous });
          emitAppToast({ tone: 'error', message: 'Employee could not be deleted.' });
        });
      },

      // ── Time Entries ──────────────────────────────────────────────────────
      clockIn: (employeeId, options) => {
        const previous = get().timeEntries;
        const workType = options.workType;
        const selectedJobIds = Array.isArray(options.jobIds)
          ? options.jobIds.filter((value, index, all) => !!value && all.indexOf(value) === index)
          : [];

        if (workType === 'job' && selectedJobIds.length === 0) {
          emitAppToast({ tone: 'error', message: 'Select at least one job to clock in.' });
          return;
        }

        const timeEntry: TimeEntry = {
          id: generateId(),
          employeeId,
          jobId: workType === 'job' ? selectedJobIds[0] : undefined,
          jobIds: workType === 'job' ? selectedJobIds : [],
          workType,
          clockIn: nowISO(),
          clockOut: undefined,
          breakMinutes: 0,
          notes: '',
          status: 'clocked_in',
        };

        set((s) => ({ timeEntries: [...s.timeEntries, timeEntry] }));

        void ensureOk(fetch(dataUrl('time-entries'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: timeEntry }),
        })).catch(() => {
          set({ timeEntries: previous });
          emitAppToast({ tone: 'error', message: 'Clock-in could not be saved.' });
        });
      },
      clockOut: (entryId, breakMinutes = 0, notes = '') => {
        const previous = get().timeEntries;
        const clockOutAt = nowISO();
        set((s) => ({
          timeEntries: s.timeEntries.map((te) =>
            te.id === entryId
              ? { ...te, clockOut: clockOutAt, breakMinutes, notes, status: 'clocked_out' }
              : te
          ),
        }));

        void ensureOk(fetch(dataUrl('time-entries', entryId), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: { clockOut: clockOutAt, breakMinutes, notes, status: 'clocked_out' } }),
        })).catch(() => {
          set({ timeEntries: previous });
          emitAppToast({ tone: 'error', message: 'Clock-out could not be saved.' });
        });
      },
      addTimeEntry: (e) => {
        const previous = get().timeEntries;
        const timeEntry: TimeEntry = { ...e, id: generateId() };
        set((s) => ({ timeEntries: [...s.timeEntries, timeEntry] }));

        void ensureOk(fetch(dataUrl('time-entries'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: timeEntry }),
        })).catch(() => {
          set({ timeEntries: previous });
          emitAppToast({ tone: 'error', message: 'Time entry could not be saved.' });
        });
      },
      deleteTimeEntry: (id) => {
        const previous = get().timeEntries;
        set((s) => ({ timeEntries: s.timeEntries.filter((te) => te.id !== id) }));

        void ensureOk(fetch(dataUrl('time-entries', id), {
          method: 'DELETE',
          credentials: 'include',
        })).catch(() => {
          set({ timeEntries: previous });
          emitAppToast({ tone: 'error', message: 'Time entry could not be deleted.' });
        });
      },

      // ── Budget ────────────────────────────────────────────────────────────
      addBudgetItem: (item) => {
        const previous = get().budgetItems;
        const budgetItem = { ...item, id: generateId() };
        set((s) => ({ budgetItems: [...s.budgetItems, budgetItem] }));

        void ensureOk(fetch(dataUrl('budget'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: budgetItem }),
        })).catch(() => {
          set({ budgetItems: previous });
          emitAppToast({ tone: 'error', message: 'Budget item could not be saved.' });
        });
      },
      updateBudgetItem: (id, data) => {
        const previous = get().budgetItems;
        set((s) => ({
          budgetItems: s.budgetItems.map((b) =>
            b.id === id ? { ...b, ...data } : b
          ),
        }));

        void ensureOk(fetch(dataUrl('budget', id), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data }),
        })).catch(() => {
          set({ budgetItems: previous });
          emitAppToast({ tone: 'error', message: 'Budget changes could not be saved.' });
        });
      },
      deleteBudgetItem: (id) => {
        const previous = get().budgetItems;
        set((s) => ({ budgetItems: s.budgetItems.filter((b) => b.id !== id) }));

        void ensureOk(fetch(dataUrl('budget', id), {
          method: 'DELETE',
          credentials: 'include',
        })).catch(() => {
          set({ budgetItems: previous });
          emitAppToast({ tone: 'error', message: 'Budget item could not be deleted.' });
        });
      },
    }),
    { name: 'oliveops-store' }
  )
);
