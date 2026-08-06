export type DocumentCategory = {
  id: string;
  label: string;
};

export type DocumentTab = {
  id: 'library' | 'upload';
  label: string;
};

export type DocumentTableColumn = string;

export declare const DOCUMENT_CATEGORIES: readonly DocumentCategory[];
export declare const DOCUMENT_TABS: readonly DocumentTab[];
export declare const DOCUMENT_TABLE_COLUMNS: readonly DocumentTableColumn[];
export declare const DOCUMENT_ACTIONS: readonly string[];

export declare function buildDocumentUploadContext(category?: string): {
  entityType: 'document';
  entityId: 'library';
  category: string;
};

export declare function filterDocuments<T extends { fileName?: string; mimeType?: string; category?: string }>(
  files: readonly T[] | T[],
  options?: {
    search?: string;
    category?: string;
  }
): T[];