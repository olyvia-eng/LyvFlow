import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStorageApiResponse, validateUploadPayload } from '../src/utils/fileUpload.js';

test('25 MB image uploads are accepted', () => {
  const result = validateUploadPayload({
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 25 * 1024 * 1024,
  });

  assert.equal(result.ok, true);
  assert.equal(result.mimeType, 'image/jpeg');
  assert.equal(result.sizeBytes, 25 * 1024 * 1024);
});

test('images above 25 MB are rejected', () => {
  const result = validateUploadPayload({
    fileName: 'photo.png',
    mimeType: 'image/png',
    sizeBytes: 25 * 1024 * 1024 + 1,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /25 MB/);
});

test('pdf above 25 MB is rejected', () => {
  const result = validateUploadPayload({
    fileName: 'receipt.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 25 * 1024 * 1024 + 1,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /25 MB/);
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

  assert.equal(docx.ok, true);
  assert.equal(xlsx.ok, true);
  assert.equal(csv.ok, true);
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
