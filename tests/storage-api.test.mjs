import test from 'node:test';
import assert from 'node:assert/strict';

import { createStorageHandler } from '../api/storage.js';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function baseDeps(overrides = {}) {
  return {
    requireSession: () => ({
      id: 'user-1',
      role: 'admin',
      businessId: 'biz-1',
      employeeId: 'emp-1',
    }),
    createPresignedUploadUrl: async () => ({ ok: true, uploadUrl: 'https://signed.example/upload', plan: { fileId: 'file-1', key: 'biz-1/file-1/photo.jpg', fileName: 'photo.jpg', mimeType: 'image/jpeg', sizeBytes: 100 } }),
    createPresignedDownloadUrl: async () => ({ ok: true, downloadUrl: 'https://signed.example/download' }),
    removeStoredFile: async () => ({ ok: true }),
    validateUploadPayload: () => ({ ok: true }),
    createAuditEventForBusiness: async () => ({ ok: true }),
    createFileForBusiness: async () => ({ ok: true }),
    deleteFileForBusiness: async () => ({ ok: true }),
    getExpenseForBusiness: async () => ({ id: 'expense-1', vendor: 'Acme', description: 'd', category: 'other', expenseDate: '2026-01-01', amount: 10, status: 'pending', notes: '' }),
    getFileForBusiness: async () => null,
    getTimeEntryForBusiness: async () => ({ id: 'time-1', employeeId: 'emp-1', status: 'clocked_in' }),
    listFilesForBusiness: async () => [],
    updateExpenseForBusiness: async () => ({ ok: true }),
    updateTimeEntryForBusiness: async () => ({ ok: true }),
    ...overrides,
  };
}

test('missing AWS_S3_BUCKET_NAME failure returns JSON from prepare-upload', async () => {
  const handler = createStorageHandler(baseDeps({
    createPresignedUploadUrl: async () => {
      const error = new Error('Missing required environment variable AWS_S3_BUCKET_NAME');
      error.name = 'MissingEnvironmentVariableError';
      throw error;
    },
  }));

  const req = {
    method: 'POST',
    body: {
      action: 'prepare-upload',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      entityType: 'time-entry',
      entityId: 'time-1',
      category: 'clock-out-photo',
    },
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {
    ok: false,
    error: 'Storage service is temporarily unavailable.',
  });
});

test('prepare-upload unexpected failure returns JSON', async () => {
  const handler = createStorageHandler(baseDeps({
    createPresignedUploadUrl: async () => {
      const error = new Error('AWS SDK failed');
      error.name = 'ServiceError';
      error.$metadata = { httpStatusCode: 500 };
      throw error;
    },
  }));

  const req = {
    method: 'POST',
    body: {
      action: 'prepare-upload',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      entityType: 'time-entry',
      entityId: 'time-1',
      category: 'clock-out-photo',
    },
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    ok: false,
    error: 'Storage service is temporarily unavailable.',
  });
});

test('complete-upload unexpected failure returns JSON', async () => {
  const handler = createStorageHandler(baseDeps({
    createFileForBusiness: async () => {
      const error = new Error('DynamoDB write failure');
      error.name = 'ProvisionedThroughputExceededException';
      error.$metadata = { httpStatusCode: 503 };
      throw error;
    },
  }));

  const req = {
    method: 'POST',
    body: {
      action: 'complete-upload',
      fileId: 'file-1',
      key: 'biz-1/file-1/photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      entityType: 'expense',
      entityId: 'expense-1',
      category: 'receipt',
    },
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {
    ok: false,
    error: 'Storage service is temporarily unavailable.',
  });
});

test('successful prepare-upload returns presigned URL payload', async () => {
  const handler = createStorageHandler(baseDeps());

  const req = {
    method: 'POST',
    body: {
      action: 'prepare-upload',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      entityType: 'time-entry',
      entityId: 'time-1',
      category: 'clock-out-photo',
    },
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(typeof res.body.uploadUrl, 'string');
  assert.equal(res.body.plan.fileId, 'file-1');
});

test('successful complete-upload returns file metadata', async () => {
  const handler = createStorageHandler(baseDeps());

  const req = {
    method: 'POST',
    body: {
      action: 'complete-upload',
      fileId: 'file-1',
      key: 'biz-1/file-1/photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      entityType: 'expense',
      entityId: 'expense-1',
      category: 'receipt',
    },
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    ok: true,
    fileId: 'file-1',
    key: 'biz-1/file-1/photo.jpg',
  });
});
