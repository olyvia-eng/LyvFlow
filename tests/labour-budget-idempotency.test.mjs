import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLabourBudgetPlanId } from '../api/_lib/authRepo.js';

test('labour budget plan ids are deterministic for the same employee and budget', () => {
  const planA = buildLabourBudgetPlanId('budget-1', 'emp-1', '2026');
  const planB = buildLabourBudgetPlanId('budget-1', 'emp-1', '2026');

  assert.equal(planA, planB);
  assert.equal(planA, 'budget-1-emp-1-2026');
});
