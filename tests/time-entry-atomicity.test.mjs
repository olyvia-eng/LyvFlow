import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildClockInTransaction,
  buildClockOutTransaction,
  getClockingErrorResponse,
} from '../api/_lib/clocking.js';

test('clock-in transaction creates one lock, one time entry, one audit event and an idempotency record', () => {
  const tx = buildClockInTransaction({
    businessId: 'biz-1',
    employeeId: 'emp-1',
    userId: 'user-1',
    timeEntryId: 'entry-1',
    clockInAt: '2026-08-05T10:00:00.000Z',
    requestId: 'req-1',
    idempotencyKey: 'key-1',
    payloadHash: 'hash-1',
    source: 'web',
    auditEventId: 'audit-1',
  });

  assert.equal(tx.TransactItems.length, 5);
  assert.equal(tx.TransactItems[0].Put.Item.entityType, 'IDEMPOTENCY');
  assert.equal(tx.TransactItems[1].ConditionCheck.Key.SK, 'ACTIVE_SHIFT');
  assert.equal(tx.TransactItems[2].Put.Item.entityType, 'ACTIVE_SHIFT');
  assert.equal(tx.TransactItems[3].Put.Item.entityType, 'TIME_ENTRY');
  assert.equal(tx.TransactItems[4].Put.Item.entityType, 'AUDIT_EVENT');
});

test('clock-out transaction updates the time entry, deletes the lock and records an audit event', () => {
  const tx = buildClockOutTransaction({
    businessId: 'biz-1',
    employeeId: 'emp-1',
    userId: 'user-1',
    timeEntryId: 'entry-1',
    clockOutAt: '2026-08-05T11:00:00.000Z',
    requestId: 'req-2',
    idempotencyKey: 'key-2',
    payloadHash: 'hash-2',
    source: 'web',
    auditEventId: 'audit-2',
    breakMinutes: 15,
    notes: 'Wrapped up',
    photoAttachmentUrl: 'https://example.com/photo.jpg',
  });

  assert.equal(tx.TransactItems.length, 6);
  assert.equal(tx.TransactItems[0].Put.Item.entityType, 'IDEMPOTENCY');
  assert.equal(tx.TransactItems[1].ConditionCheck.Key.SK, 'ACTIVE_SHIFT');
  assert.equal(tx.TransactItems[2].ConditionCheck.Key.SK, 'TIME#entry-1');
  assert.equal(tx.TransactItems[3].Update.Key.SK, 'TIME#entry-1');
  assert.equal(tx.TransactItems[4].Delete.Key.SK, 'ACTIVE_SHIFT');
  assert.equal(tx.TransactItems[5].Put.Item.entityType, 'AUDIT_EVENT');
});

test('clocking errors are normalized into client-safe responses', () => {
  const response = getClockingErrorResponse({ statusCode: 409, code: 'ALREADY_CLOCKED_IN' });
  assert.equal(response.status, 409);
  assert.equal(response.error, 'Already Clocked In');
});
