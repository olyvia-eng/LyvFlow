import test from 'node:test';
import assert from 'node:assert/strict';

import {
  beginClockOutSubmission,
  createClockOutRequestMeta,
  endClockOutSubmission,
} from '../src/utils/clockOutSubmission.js';

test('one clock-out request is allowed per click intent', () => {
  const begin = beginClockOutSubmission([], 'entry-1');
  assert.equal(begin.allowed, true);
  assert.deepEqual(begin.nextInFlightEntryIds, ['entry-1']);
});

test('double-click protection rejects duplicate in-flight clock-out', () => {
  const first = beginClockOutSubmission([], 'entry-1');
  const second = beginClockOutSubmission(first.nextInFlightEntryIds, 'entry-1');
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
  assert.deepEqual(second.nextInFlightEntryIds, ['entry-1']);
});

test('clock-out in-flight state clears after completion', () => {
  const inFlight = beginClockOutSubmission([], 'entry-1').nextInFlightEntryIds;
  const after = endClockOutSubmission(inFlight, 'entry-1');
  assert.deepEqual(after, []);
});

test('clock-out request includes deterministic request and idempotency identifiers', () => {
  const meta = createClockOutRequestMeta('entry-1');
  assert.equal(typeof meta.requestId, 'string');
  assert.equal(typeof meta.idempotencyKey, 'string');
  assert.ok(meta.requestId.includes('entry-1'));
  assert.ok(meta.idempotencyKey.startsWith('entry-1:'));
});
