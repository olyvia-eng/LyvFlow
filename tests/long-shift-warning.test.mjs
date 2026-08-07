import test from 'node:test';
import assert from 'node:assert/strict';

import { isPossiblyForgottenClockOut } from '../api/_lib/clocking.js';

test('long active shift is flagged after threshold', () => {
  const result = isPossiblyForgottenClockOut({
    clockInAt: '2026-08-07T06:00:00.000Z',
    now: '2026-08-07T19:00:00.000Z',
    thresholdHours: 12,
  });

  assert.equal(result, true);
});

test('shift below threshold is not flagged', () => {
  const result = isPossiblyForgottenClockOut({
    clockInAt: '2026-08-07T06:00:00.000Z',
    now: '2026-08-07T15:00:00.000Z',
    thresholdHours: 12,
  });

  assert.equal(result, false);
});

test('warning helper never mutates clock data or performs auto clock-out', () => {
  const clockInAt = '2026-08-07T06:00:00.000Z';
  const snapshot = { clockInAt };
  const result = isPossiblyForgottenClockOut({
    clockInAt,
    now: '2026-08-07T20:00:00.000Z',
    thresholdHours: 12,
  });

  assert.equal(result, true);
  assert.deepEqual(snapshot, { clockInAt: '2026-08-07T06:00:00.000Z' });
});
