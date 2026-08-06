export const DOCUMENT_CATEGORIES = [
  { id: 'contracts', label: 'Contracts' },
  { id: 'proposals', label: 'Proposals' },
  { id: 'permits', label: 'Permits' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'photos', label: 'Photos' },
  { id: 'misc', label: 'Miscellaneous' },
];

export const DOCUMENT_TABS = [
  { id: 'library', label: 'Library' },
  { id: 'upload', label: 'Upload' },
];

export const DOCUMENT_TABLE_COLUMNS = [
  'Document',
  'Category',
  'Type',
  'Size',
  'Uploaded',
  'Actions',
];

export const DOCUMENT_ACTIONS = ['view', 'download', 'delete'];

export function buildDocumentUploadContext(category) {
  const safeCategory = typeof category === 'string' && category.trim().length > 0
    ? category.trim()
    : 'misc';

  return {
    entityType: 'document',
    entityId: 'library',
    category: safeCategory,
  };
}

export function filterDocuments(files, { search = '', category = 'all' } = {}) {
  const normalizedSearch = typeof search === 'string' ? search.trim().toLowerCase() : '';
  return (Array.isArray(files) ? files : []).filter((file) => {
    const matchesCategory = category === 'all' || file.category === category;
    if (!matchesCategory) return false;
    if (!normalizedSearch) return true;
    const haystack = `${file.fileName || ''} ${file.mimeType || ''}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });
}
