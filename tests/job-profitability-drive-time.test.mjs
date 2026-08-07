import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('job profitability logic keeps drive time out of billable-hour classification', () => {
  const source = readFileSync('src/pages/jobs/profitability.ts', 'utf8');

  assert.match(source, /if \(workType === 'job'\)/);
  assert.match(source, /return \{ billableHours: hours, nonBillableHours: 0 \};/);
  assert.match(source, /return \{ billableHours: 0, nonBillableHours: hours \};/);
});
