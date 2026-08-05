import {
  validateUploadPayload as validateUploadPayloadJs,
  uploadFileToStorage as uploadFileToStorageJs,
  resolveAttachmentUrl as resolveAttachmentUrlJs,
  parseStorageApiResponse as parseStorageApiResponseJs,
} from './fileUpload.js';

export const validateUploadPayload = validateUploadPayloadJs as (input: {
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
}) =>
  | { ok: true; fileName: string; mimeType: string; sizeBytes: number }
  | { ok: false; error: string };

export const uploadFileToStorage = uploadFileToStorageJs as (input: {
  file: File;
  entityType: string;
  entityId: string;
  category: string;
}) => Promise<{ fileId: string; key: string }>;

export const resolveAttachmentUrl = resolveAttachmentUrlJs as (input: {
  fileId?: string;
  legacyUrl?: string;
}) => Promise<string>;

export const parseStorageApiResponse = parseStorageApiResponseJs as (
  response: Response,
  fallbackErrorMessage?: string,
) => Promise<Record<string, unknown>>;
