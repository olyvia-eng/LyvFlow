import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Customer,
  Estimate,
  EstimateTemplate,
  Job,
  Employee,
  TimeEntry,
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
  { id: 'e1', name: 'Dan Foreman', email: 'dan@lyvflow.ca', phone: '(613) 555-1001', role: 'foreman', hourlyRate: 45, active: true, pin: '1234', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'e2', name: 'Eva Crew', email: 'eva@lyvflow.ca', phone: '(613) 555-1002', role: 'worker', hourlyRate: 32, active: true, pin: '2345', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'e3', name: 'Frank Worker', email: 'frank@lyvflow.ca', phone: '(613) 555-1003', role: 'worker', hourlyRate: 30, active: true, pin: '3456', createdAt: '2025-01-01T00:00:00.000Z' },
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
  { id: 'te1', employeeId: 'e1', jobId: 'j1', clockIn: '2025-04-05T08:00:00.000Z', clockOut: '2025-04-05T16:30:00.000Z', breakMinutes: 30, notes: '', status: 'clocked_out' },
  { id: 'te2', employeeId: 'e2', jobId: 'j1', clockIn: '2025-04-05T08:00:00.000Z', clockOut: '2025-04-05T16:00:00.000Z', breakMinutes: 30, notes: '', status: 'clocked_out' },
  { id: 'te3', employeeId: 'e1', jobId: 'j2', clockIn: '2025-05-12T07:00:00.000Z', clockOut: '2025-05-12T15:00:00.000Z', breakMinutes: 30, notes: '', status: 'clocked_out' },
  { id: 'te4', employeeId: 'e2', jobId: 'j2', clockIn: '2025-05-12T07:00:00.000Z', clockOut: '2025-05-12T15:00:00.000Z', breakMinutes: 30, notes: '', status: 'clocked_out' },
  { id: 'te5', employeeId: 'e3', jobId: 'j2', clockIn: '2025-05-12T07:00:00.000Z', clockOut: '2025-05-12T14:30:00.000Z', breakMinutes: 30, notes: '', status: 'clocked_out' },
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
  clockIn: (employeeId: ID, jobId: ID) => void;
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
      addCustomer: (c) =>
        set((s) => ({
          customers: [
            ...s.customers,
            { ...c, id: generateId(), createdAt: nowISO(), updatedAt: nowISO() },
          ],
        })),
      updateCustomer: (id, data) =>
        set((s) => ({
          customers: s.customers.map((c) =>
            c.id === id ? { ...c, ...data, updatedAt: nowISO() } : c
          ),
        })),
      deleteCustomer: (id) =>
        set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),

      // ── Estimates ─────────────────────────────────────────────────────────
      addEstimate: (e) =>
        set((s) => ({
          estimates: [
            ...s.estimates,
            { ...e, id: generateId(), createdAt: nowISO(), updatedAt: nowISO() },
          ],
        })),
      updateEstimate: (id, data) =>
        set((s) => ({
          estimates: s.estimates.map((e) =>
            e.id === id ? { ...e, ...data, updatedAt: nowISO() } : e
          ),
        })),
      deleteEstimate: (id) =>
        set((s) => ({ estimates: s.estimates.filter((e) => e.id !== id) })),
      sendEstimate: (id) =>
        set((s) => ({
          estimates: s.estimates.map((e) =>
            e.id === id ? { ...e, status: 'sent', sentAt: nowISO(), updatedAt: nowISO() } : e
          ),
        })),
      convertEstimateToJob: (estimateId) => {
        const { estimates, customers } = get();
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
      },

      // ── Templates ─────────────────────────────────────────────────────────
      addTemplate: (t) =>
        set((s) => ({
          templates: [
            ...s.templates,
            { ...t, id: generateId(), createdAt: nowISO() },
          ],
        })),
      updateTemplate: (id, data) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id ? { ...t, ...data } : t
          ),
        })),
      deleteTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      // ── Jobs ──────────────────────────────────────────────────────────────
      addJob: (j) =>
        set((s) => ({
          jobs: [
            ...s.jobs,
            { ...j, id: generateId(), createdAt: nowISO(), updatedAt: nowISO() },
          ],
        })),
      updateJob: (id, data) =>
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id ? { ...j, ...data, updatedAt: nowISO() } : j
          ),
        })),
      deleteJob: (id) =>
        set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
      addCostEntry: (jobId, entry) => {
        const id = generateId();
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId
              ? { ...j, actualCosts: [...j.actualCosts, { ...entry, id }], updatedAt: nowISO() }
              : j
          ),
        }));
      },

      // ── Employees ─────────────────────────────────────────────────────────
      addEmployee: (e) =>
        set((s) => ({
          employees: [...s.employees, { ...e, id: generateId(), createdAt: nowISO() }],
        })),
      updateEmployee: (id, data) =>
        set((s) => ({
          employees: s.employees.map((e) =>
            e.id === id ? { ...e, ...data } : e
          ),
        })),
      deleteEmployee: (id) =>
        set((s) => ({ employees: s.employees.filter((e) => e.id !== id) })),

      // ── Time Entries ──────────────────────────────────────────────────────
      clockIn: (employeeId, jobId) =>
        set((s) => ({
          timeEntries: [
            ...s.timeEntries,
            {
              id: generateId(),
              employeeId,
              jobId,
              clockIn: nowISO(),
              clockOut: undefined,
              breakMinutes: 0,
              notes: '',
              status: 'clocked_in',
            },
          ],
        })),
      clockOut: (entryId, breakMinutes = 0, notes = '') =>
        set((s) => ({
          timeEntries: s.timeEntries.map((te) =>
            te.id === entryId
              ? { ...te, clockOut: nowISO(), breakMinutes, notes, status: 'clocked_out' }
              : te
          ),
        })),
      addTimeEntry: (e) =>
        set((s) => ({ timeEntries: [...s.timeEntries, { ...e, id: generateId() }] })),
      deleteTimeEntry: (id) =>
        set((s) => ({ timeEntries: s.timeEntries.filter((te) => te.id !== id) })),

      // ── Budget ────────────────────────────────────────────────────────────
      addBudgetItem: (item) =>
        set((s) => ({ budgetItems: [...s.budgetItems, { ...item, id: generateId() }] })),
      updateBudgetItem: (id, data) =>
        set((s) => ({
          budgetItems: s.budgetItems.map((b) =>
            b.id === id ? { ...b, ...data } : b
          ),
        })),
      deleteBudgetItem: (id) =>
        set((s) => ({ budgetItems: s.budgetItems.filter((b) => b.id !== id) })),
    }),
    { name: 'lyvflow-store' }
  )
);
