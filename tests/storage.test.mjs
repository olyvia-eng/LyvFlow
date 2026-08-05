import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeFilename,
  buildStorageKey,
  createPendingUploadPlan,
  isPendingUploadExpired,
} from '../api/_lib/storage.js';

test('sanitizeFilename strips unsafe characters and preserves extension', () => {
  assert.equal(sanitizeFilename('../../evil.png'), 'evil.png');
  assert.equal(sanitizeFilename('  Photo 1.JPG  '), 'Photo-1.JPG');
});

test('storage keys are scoped to the business and file id', () => {
  const plan = createPendingUploadPlan({
    businessId: 'biz-1',
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
  });

  assert.match(plan.key, /^biz-1\//);
  assert.equal(plan.key.endsWith('/photo.jpg'), true);
  assert.equal(plan.fileId.length > 0, true);
});

test('pending-upload plans expire once the deadline passes', () => {
  const plan = createPendingUploadPlan({
    businessId: 'biz-1',
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    expiresInMs: 50,
  });

  assert.equal(isPendingUploadExpired(plan.expiresAt), false);
  assert.equal(isPendingUploadExpired(new Date(Date.now() + 1000).toISOString()), false);
  assert.equal(isPendingUploadExpired(new Date(Date.now() - 1000).toISOString()), true);
});

test('storage key builder normalizes the filename for safe object storage paths', () => {
  const key = buildStorageKey({ businessId: 'biz-1', fileId: 'file-1', fileName: 'My Resume.pdf' });
  assert.equal(key, 'biz-1/file-1/My-Resume.pdf');
});
