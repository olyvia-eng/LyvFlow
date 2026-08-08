import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStorageApiResponse, uploadFileToStorage, validateUploadPayload } from '../src/utils/fileUpload.js';

test('25 MB image uploads are accepted', () => {
  const result = validateUploadPayload({
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 25 * 1024 * 1024,
  });

  assert.equal(result.valid, true);
  assert.equal(result.mimeType, 'image/jpeg');
  assert.equal(result.sizeBytes, 25 * 1024 * 1024);
});

test('HEIC and HEIF images are accepted', () => {
  const heic = validateUploadPayload({
    fileName: 'field-photo.heic',
    mimeType: 'image/heic',
    sizeBytes: 1024,
  });
  const heif = validateUploadPayload({
    fileName: 'field-photo.heif',
    mimeType: 'image/heif',
    sizeBytes: 1024,
  });

  assert.equal(heic.valid, true);
  assert.equal(heif.valid, true);
});

test('images above 25 MB are rejected', () => {
  const result = validateUploadPayload({
    fileName: 'photo.png',
    mimeType: 'image/png',
    sizeBytes: 25 * 1024 * 1024 + 1,
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /25 MB/);
});

test('pdf above 25 MB is rejected', () => {
  const result = validateUploadPayload({
    fileName: 'receipt.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 25 * 1024 * 1024 + 1,
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /25 MB/);
});

test('mismatched file extension is rejected', () => {
  const result = validateUploadPayload({
    fileName: 'receipt.jpg',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /extension/i);
});

test('office documents use their own limits', () => {
  const docx = validateUploadPayload({
    fileName: 'report.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: 15 * 1024 * 1024,
  });
  const xlsx = validateUploadPayload({
    fileName: 'budget.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: 15 * 1024 * 1024,
  });
  const csv = validateUploadPayload({
    fileName: 'data.csv',
    mimeType: 'text/csv',
    sizeBytes: 5 * 1024 * 1024,
  });

  assert.equal(docx.valid, true);
  assert.equal(xlsx.valid, true);
  assert.equal(csv.valid, true);
});

test('non-JSON API response is handled cleanly by client parser', async () => {
  const response = new Response('Service unavailable', {
    status: 503,
    headers: {
      'Content-Type': 'text/plain',
    },
  });

  const payload = await parseStorageApiResponse(response, 'Storage service is temporarily unavailable.');
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'Service unavailable');
});

test('complete-upload request includes only action and fileId', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, init });

    if (url === '/api/storage') {
      const body = JSON.parse(init.body);
      if (body.action === 'prepare-upload') {
        return new Response(JSON.stringify({
          ok: true,
          fileId: 'file-123',
          uploadUrl: 'https://signed.example/upload/file-123',
          requiredHeaders: { 'Content-Type': 'image/jpeg' },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (body.action === 'complete-upload') {
        return new Response(JSON.stringify({ ok: true, fileId: 'file-123' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (url === 'https://signed.example/upload/file-123') {
      return new Response(null, { status: 200 });
    }

    return new Response('Unexpected request', { status: 500 });
  };

  try {
    const file = new File(['binary-data'], 'clockout.jpg', { type: 'image/jpeg' });
    const result = await uploadFileToStorage({
      file,
      entityType: 'time-entry',
      entityId: 'time-1',
      category: 'clock-out-photo',
    });

    assert.equal(result.fileId, 'file-123');

    const completionCall = calls.find((call) => {
      if (call.url !== '/api/storage') return false;
      const body = JSON.parse(call.init.body);
      return body.action === 'complete-upload';
    });

    assert.ok(completionCall, 'expected completion call to storage API');
    const completionPayload = JSON.parse(completionCall.init.body);
    assert.deepEqual(completionPayload, { action: 'complete-upload', fileId: 'file-123' });
    assert.equal(Object.keys(completionPayload).length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
