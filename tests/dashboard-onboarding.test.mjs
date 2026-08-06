import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDashboardOnboardingItems,
  calculateDashboardOnboardingProgress,
} from '../src/components/dashboard/onboardingProgress.js';

function baseData(overrides = {}) {
  return {
    businessName: '',
    employees: [],
    customers: [],
    estimates: [],
    jobs: [],
    timeEntries: [],
    expenses: [],
    ...overrides,
  };
}

test('onboarding starts at zero when no data exists', () => {
  const items = buildDashboardOnboardingItems(baseData());
  const progress = calculateDashboardOnboardingProgress(items);

  assert.equal(items.length, 8);
  assert.equal(progress.completeCount, 0);
  assert.equal(progress.percent, 0);
  assert.equal(progress.isComplete, false);
});

test('onboarding marks receipt step complete when receiptFileId exists', () => {
  const items = buildDashboardOnboardingItems(baseData({
    expenses: [
      {
        id: 'expense-1',
        vendor: 'Acme',
        description: 'Materials',
        category: 'materials',
        expenseDate: '2026-01-01',
        amount: 100,
        status: 'pending',
        notes: '',
        receiptFileId: 'file-123',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  }));

  const receiptStep = items.find((item) => item.id === 'first-expense-receipt');
  assert.equal(receiptStep?.complete, true);
});

test('onboarding marks profitability step complete from job costing data', () => {
  const items = buildDashboardOnboardingItems(baseData({
    jobs: [
      {
        id: 'job-1',
        customerId: 'customer-1',
        title: 'Demo Job',
        description: '',
        status: 'in_progress',
        startDate: '2026-01-01',
        estimatedHours: 10,
        actualHours: 4,
        estimatedCost: 0,
        actualCosts: [],
        contractValue: 1000,
        assignedEmployeeIds: [],
        notes: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  }));

  const profitabilityStep = items.find((item) => item.id === 'first-profitability');
  assert.equal(profitabilityStep?.complete, true);
});

test('onboarding progress reaches 100 when all checklist conditions are met', () => {
  const items = buildDashboardOnboardingItems(baseData({
    businessName: 'OliveOps Contracting',
    employees: [
      {
        id: 'emp-1',
        name: 'Sam',
        email: 'sam@example.com',
        phone: '',
        role: 'foreman',
        hourlyRate: 30,
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    customers: [
      {
        id: 'customer-1',
        name: 'Acme',
        company: 'Acme Inc',
        email: 'acme@example.com',
        phone: '',
        properties: [],
        status: 'active',
        notes: '',
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    estimates: [
      {
        id: 'estimate-1',
        customerId: 'customer-1',
        title: 'Estimate',
        description: '',
        status: 'draft',
        lineItems: [],
        taxRate: 0,
        notes: '',
        validUntil: '2026-01-10',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    jobs: [
      {
        id: 'job-1',
        customerId: 'customer-1',
        title: 'Demo Job',
        description: '',
        status: 'in_progress',
        startDate: '2026-01-01',
        estimatedHours: 10,
        actualHours: 0,
        estimatedCost: 0,
        actualCosts: [{ id: 'cost-1', category: 'labour', description: '', quantity: 1, unit: 'hr', unitCost: 25, total: 25, date: '2026-01-01' }],
        contractValue: 1000,
        assignedEmployeeIds: [],
        notes: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    timeEntries: [
      {
        id: 'time-1',
        employeeId: 'emp-1',
        workType: 'job',
        jobId: 'job-1',
        clockIn: '2026-01-01T08:00:00.000Z',
        breakMinutes: 0,
        notes: '',
        status: 'clocked_out',
      },
    ],
    expenses: [
      {
        id: 'expense-1',
        vendor: 'Acme',
        description: 'Materials',
        category: 'materials',
        expenseDate: '2026-01-01',
        amount: 100,
        status: 'pending',
        notes: '',
        receiptFileId: 'file-123',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  }));

  const progress = calculateDashboardOnboardingProgress(items);
  assert.equal(progress.completeCount, 8);
  assert.equal(progress.percent, 100);
  assert.equal(progress.isComplete, true);
});
