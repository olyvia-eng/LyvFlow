import { create } from 'zustand';
import type {
  Customer,
  Estimate,
  EstimateTemplate,
  Job,
  Employee,
  TimeEntry,
  TimeEntryWorkType,
  BudgetItem,
  CostEntry,
  ID,
} from '../types';
import {
  generateId,
  nowISO,
} from '../utils';
import { emitAppToast } from '../toast';

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
  updateTimeEntry: (id: ID, data: Partial<TimeEntry>) => void;
  deleteTimeEntry: (id: ID) => void;

  // Budget
  addBudgetItem: (item: Omit<BudgetItem, 'id'>) => void;
  updateBudgetItem: (id: ID, data: Partial<BudgetItem>) => void;
  deleteBudgetItem: (id: ID) => void;
}

export const useStore = create<AppState>()((set, get) => ({
      customers: [],
      estimates: [],
      templates: [],
      jobs: [],
      employees: [],
      timeEntries: [],
      budgetItems: [],

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
          workAreas: [...(est.workAreas ?? [])],
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
      updateTimeEntry: (id, data) => {
        const previous = get().timeEntries;
        set((s) => ({
          timeEntries: s.timeEntries.map((te) =>
            te.id === id ? { ...te, ...data } : te
          ),
        }));

        void ensureOk(fetch(dataUrl('time-entries', id), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data }),
        })).catch(() => {
          set({ timeEntries: previous });
          emitAppToast({ tone: 'error', message: 'Time entry could not be updated.' });
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
    }));
