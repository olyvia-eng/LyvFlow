import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildClockInTransaction,
  buildClockOutTransaction,
  getClockingErrorResponse,
  getClockingFailureResponse,
  resolveClockOutActiveShift,
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

  assert.equal(tx.TransactItems.length, 4);
  assert.equal(tx.TransactItems[0].Put.Item.entityType, 'IDEMPOTENCY');
  assert.equal(tx.TransactItems[1].Put.Item.entityType, 'ACTIVE_SHIFT');
  assert.equal(tx.TransactItems[2].Put.Item.entityType, 'TIME_ENTRY');
  assert.equal(tx.TransactItems[3].Put.Item.entityType, 'AUDIT_EVENT');
});

test('clock-in uses a conditional put for the active-shift lock and no condition checks', () => {
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

  assert.equal(tx.TransactItems.filter((item) => item.ConditionCheck).length, 0);
  assert.equal(tx.TransactItems.filter((item) => item.Put?.Item?.entityType === 'ACTIVE_SHIFT').length, 1);
});

test('clock-in lock requires active-shift key to not exist (single active shift guarantee)', () => {
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

  const lockPut = tx.TransactItems.find((item) => item.Put?.Item?.entityType === 'ACTIVE_SHIFT');
  assert.ok(lockPut);
  assert.equal(lockPut.Put.ConditionExpression, 'attribute_not_exists(PK) AND attribute_not_exists(SK)');
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

  assert.equal(tx.TransactItems.length, 4);
  assert.equal(tx.TransactItems.filter((item) => item.Put?.Item?.entityType === 'IDEMPOTENCY').length, 1);
  assert.equal(tx.TransactItems.filter((item) => item.Delete?.Key?.SK === 'ACTIVE_SHIFT').length, 1);
  assert.equal(tx.TransactItems.filter((item) => item.Update?.Key?.SK === 'TIME#entry-1').length, 1);
  assert.equal(tx.TransactItems.filter((item) => item.Put?.Item?.entityType === 'AUDIT_EVENT').length, 1);
  assert.equal(tx.TransactItems.filter((item) => item.Put?.Item?.entityType === 'CLOCK_OUT_STATE').length, 0);

  const targets = tx.TransactItems.map((item) => {
    if (item.Put) return `PUT:${item.Put.Item.PK}:${item.Put.Item.SK}`;
    if (item.Delete) return `DELETE:${item.Delete.Key.PK}:${item.Delete.Key.SK}`;
    if (item.Update) return `UPDATE:${item.Update.Key.PK}:${item.Update.Key.SK}`;
    return null;
  }).filter(Boolean);

  assert.equal(new Set(targets).size, targets.length);
});

test('clock-out transaction never introduces duplicate target keys', () => {
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
  });

  const keys = tx.TransactItems.map((item) => {
    if (item.Put) return `${item.Put.Item.PK}|${item.Put.Item.SK}`;
    if (item.Delete) return `${item.Delete.Key.PK}|${item.Delete.Key.SK}`;
    if (item.Update) return `${item.Update.Key.PK}|${item.Update.Key.SK}`;
    return null;
  }).filter(Boolean);

  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  assert.deepEqual(duplicates, []);
});

test('clock-out uses a conditional delete for the active-shift lock and a conditional update for the time entry', () => {
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

  assert.equal(tx.TransactItems.filter((item) => item.ConditionCheck).length, 0);
  assert.equal(tx.TransactItems.filter((item) => item.Delete?.Key?.SK === 'ACTIVE_SHIFT').length, 1);
  assert.equal(tx.TransactItems.filter((item) => item.Update?.Key?.SK === 'TIME#entry-1').length, 1);
});

test('clock-out includes photo attachment updates when a photo URL is provided', () => {
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
    photoAttachmentUrl: 'https://example.com/photo.jpg',
  });

  const update = tx.TransactItems.find((item) => item.Update);
  assert.match(update.Update.UpdateExpression, /#photoAttachmentUrl/);
  assert.ok(Object.prototype.hasOwnProperty.call(update.Update.ExpressionAttributeValues, ':photoAttachmentUrl'));
});

test('clock-out omits photo attachment updates when no photo URL is provided', () => {
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
  });

  const update = tx.TransactItems.find((item) => item.Update);
  assert.ok(!update.Update.UpdateExpression.includes('#photoAttachmentUrl'));
  assert.ok(!Object.prototype.hasOwnProperty.call(update.Update.ExpressionAttributeValues, ':photoAttachmentUrl'));
});

test('clocking errors are normalized into client-safe responses', () => {
  const response = getClockingErrorResponse({ statusCode: 409, code: 'ALREADY_CLOCKED_IN' });
  assert.equal(response.status, 409);
  assert.equal(response.error, 'Already Clocked In');
});

test('active shift exists and matches the requested entry id', () => {
  const result = resolveClockOutActiveShift({
    activeShift: { activeEntryId: 'entry-1' },
    requestedEntryId: 'entry-1',
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, 'match');
});

test('active shift is missing', () => {
  const result = resolveClockOutActiveShift({
    activeShift: null,
    requestedEntryId: 'entry-1',
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'missing-active-shift');
  assert.equal(result.status, 409);
});

test('active shift with no activeEntryId is rejected', () => {
  const result = resolveClockOutActiveShift({
    activeShift: { activeEntryId: '' },
    requestedEntryId: 'entry-1',
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'missing-active-entry-id');
  assert.equal(result.status, 409);
});

test('active shift pointing to another entry is rejected', () => {
  const result = resolveClockOutActiveShift({
    activeShift: { activeEntryId: 'entry-2' },
    requestedEntryId: 'entry-1',
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'entry-mismatch');
  assert.equal(result.status, 409);
});

test('None cancellation reasons are ignored', () => {
  const response = getClockingFailureResponse('clock-out', {
    name: 'TransactionCanceledException',
    CancellationReasons: [{ Code: 'None' }],
  });

  assert.equal(response.status, 500);
  assert.equal(response.error, 'Clocking request failed');
});

test('ConditionalCheckFailed is recognized', () => {
  const response = getClockingFailureResponse('clock-out', {
    name: 'TransactionCanceledException',
    CancellationReasons: [{ Code: 'ConditionalCheckFailed' }],
  });

  assert.equal(response.status, 409);
  assert.equal(response.error, 'No active shift found');
});

test('clock-in conditional lock failure is normalized to Already Clocked In', () => {
  const response = getClockingFailureResponse('clock-in', {
    name: 'TransactionCanceledException',
    CancellationReasons: [{ Code: 'ConditionalCheckFailed' }],
  });

  assert.equal(response.status, 409);
  assert.equal(response.error, 'Already Clocked In');
});

test('unexpected ValidationException returns 500', () => {
  const response = getClockingFailureResponse('clock-out', {
    name: 'ValidationException',
    message: 'bad request',
  });

  assert.equal(response.status, 500);
  assert.equal(response.error, 'Clocking request failed');
});
