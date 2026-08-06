import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDocumentUploadContext,
  DOCUMENT_ACTIONS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_TABLE_COLUMNS,
  DOCUMENT_TABS,
  filterDocuments,
} from '../src/pages/data-center/documentsConfig.js';

test('documents page restores expected tabs and table columns', () => {
  assert.ok(DOCUMENT_TABS.some((item) => item.id === 'library'));
  assert.ok(DOCUMENT_TABS.some((item) => item.id === 'upload'));
  assert.ok(DOCUMENT_TABLE_COLUMNS.includes('Document'));
  assert.ok(DOCUMENT_TABLE_COLUMNS.includes('Category'));
  assert.ok(DOCUMENT_TABLE_COLUMNS.includes('Actions'));
});

test('documents page restores expected row actions', () => {
  assert.ok(DOCUMENT_ACTIONS.includes('view'));
  assert.ok(DOCUMENT_ACTIONS.includes('download'));
  assert.ok(DOCUMENT_ACTIONS.includes('delete'));
});

test('documents page includes baseline categories', () => {
  const categoryIds = DOCUMENT_CATEGORIES.map((item) => item.id);
  assert.ok(categoryIds.includes('contracts'));
  assert.ok(categoryIds.includes('proposals'));
  assert.ok(categoryIds.includes('permits'));
  assert.ok(categoryIds.includes('insurance'));
  assert.ok(categoryIds.includes('compliance'));
  assert.ok(categoryIds.includes('misc'));
});

test('document upload context uses S3 attachment-safe metadata', () => {
  const context = buildDocumentUploadContext('contracts');
  assert.equal(context.entityType, 'document');
  assert.equal(context.entityId, 'library');
  assert.equal(context.category, 'contracts');
});

test('document filters keep existing records and apply category/search controls', () => {
  const files = [
    { fileName: 'Master Contract.pdf', mimeType: 'application/pdf', category: 'contracts' },
    { fileName: 'City Permit.pdf', mimeType: 'application/pdf', category: 'permits' },
  ];

  const byCategory = filterDocuments(files, { category: 'contracts', search: '' });
  assert.equal(byCategory.length, 1);
  assert.equal(byCategory[0].category, 'contracts');

  const bySearch = filterDocuments(files, { category: 'all', search: 'permit' });
  assert.equal(bySearch.length, 1);
  assert.equal(bySearch[0].fileName, 'City Permit.pdf');
});
