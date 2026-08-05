import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCreateUserEmployeePayload, createUserEmployeePair } from '../api/_lib/authRepo.js';

function asPayload() {
  return buildCreateUserEmployeePayload({
    businessId: 'biz-1',
    name: 'Alex Crew',
    email: 'alex@example.com',
    password: 'secret1234',
    role: 'crew_member',
  });
}

test('buildCreateUserEmployeePayload returns one stable employee and one auth user payload', () => {
  const payload = asPayload();
  assert.equal(payload.userItem.userId, payload.employeeItem.employeeId);
  assert.equal(payload.userItem.email, 'alex@example.com');
  assert.equal(payload.employeeItem.email, 'alex@example.com');
  assert.equal(payload.employeeItem.role, 'crew_member');
});

test('createUserEmployeePair returns the same employee and user payload when retried', async () => {
  const first = await createUserEmployeePair({
    businessId: 'biz-1',
    name: 'Alex Crew',
    email: 'alex@example.com',
    password: 'secret1234',
    role: 'crew_member',
  });
  const second = await createUserEmployeePair({
    businessId: 'biz-1',
    name: 'Alex Crew',
    email: 'alex@example.com',
    password: 'secret1234',
    role: 'crew_member',
  });

  assert.equal(first.employee.id, second.employee.id);
  assert.equal(first.user.id, second.user.id);
  assert.equal(first.employee.id, first.user.id);
});
