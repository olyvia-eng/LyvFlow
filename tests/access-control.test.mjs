import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canReadEntity,
  canWriteEntity,
  filterRecordsForSession,
  authorizeRecordAccess,
  canClockForEmployee,
} from '../api/_lib/authorization.js';

test('owner and admin roles retain broad access', () => {
  assert.equal(canReadEntity('budgets', 'owner'), true);
  assert.equal(canWriteEntity('time-entries', 'admin'), true);
});

test('crew members can only see their own time entries and submissions', () => {
  const session = { role: 'crew_member', employeeId: 'emp-1', businessId: 'biz-1' };
  const records = [
    { id: 't1', employeeId: 'emp-1' },
    { id: 't2', employeeId: 'emp-2' },
  ];

  assert.deepEqual(filterRecordsForSession(session, 'time-entries', records), [{ id: 't1', employeeId: 'emp-1' }]);
  assert.deepEqual(filterRecordsForSession(session, 'form-submissions', records), [{ id: 't1', employeeId: 'emp-1' }]);
});

test('crew members can only access jobs assigned to them', () => {
  const session = { role: 'crew_member', employeeId: 'emp-1', businessId: 'biz-1' };
  const records = [
    { id: 'job-1', assignedEmployeeIds: ['emp-1'] },
    { id: 'job-2', assignedEmployeeIds: ['emp-2'] },
  ];

  assert.deepEqual(filterRecordsForSession(session, 'jobs', records), [{ id: 'job-1', assignedEmployeeIds: ['emp-1'] }]);
});

test('clocking authorization allows self-service and blocks other employees for crew members', () => {
  const session = { role: 'crew_member', employeeId: 'emp-1', businessId: 'biz-1' };

  assert.equal(canClockForEmployee(session, 'emp-1'), true);
  assert.equal(canClockForEmployee(session, 'emp-2'), false);
});

test('owners and admins can clock any employee', () => {
  const ownerSession = { role: 'owner', employeeId: 'emp-1', businessId: 'biz-1' };
  const adminSession = { role: 'admin', employeeId: 'emp-1', businessId: 'biz-1' };

  assert.equal(canClockForEmployee(ownerSession, 'emp-2'), true);
  assert.equal(canClockForEmployee(adminSession, 'emp-2'), true);
});

test('crew members cannot write budgets or invoices', () => {
  assert.equal(canWriteEntity('budgets', 'crew_member'), false);
  assert.equal(canWriteEntity('invoices', 'crew_member'), false);
});

test('crew members can access their own employee profile but not others', () => {
  const session = { role: 'crew_member', employeeId: 'emp-1', businessId: 'biz-1' };
  assert.equal(authorizeRecordAccess(session, 'employees', { id: 'emp-1' }), true);
  assert.equal(authorizeRecordAccess(session, 'employees', { id: 'emp-2' }), false);
});
