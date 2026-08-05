import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireEnv } from './env.js';
import { generateId } from './authRepo.js';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]);
const IMAGE_LIMIT_BYTES = 25 * 1024 * 1024;
const PDF_LIMIT_BYTES = 25 * 1024 * 1024;
const OFFICE_LIMIT_BYTES = 15 * 1024 * 1024;
const CSV_LIMIT_BYTES = 5 * 1024 * 1024;
const DEFAULT_EXPIRES_IN_MS = 10 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

export function sanitizeFilename(fileName) {
  if (typeof fileName !== 'string' || !fileName.trim()) return 'file';

  const trimmed = fileName.trim().replace(/\\/g, '/').replace(/^\.+/, '').replace(/\s+/g, '-');
  const baseName = trimmed.split('/').pop() ?? 'file';
  const lastDot = baseName.lastIndexOf('.');
  const extension = lastDot > -1 ? baseName.slice(lastDot) : '';
  const nameWithoutExtension = lastDot > -1 ? baseName.slice(0, lastDot) : baseName;
  const safeName = nameWithoutExtension
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'file';

  return `${safeName}${extension}`;
}

export function buildStorageKey({ businessId, fileId, fileName }) {
  const resolvedName = sanitizeFilename(fileName);
  return `${businessId}/${fileId}/${resolvedName}`;
}

export function createPendingUploadPlan({ businessId, fileName, mimeType, sizeBytes, expiresInMs = DEFAULT_EXPIRES_IN_MS }) {
  const fileId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const sanitizedName = sanitizeFilename(fileName);
  const key = buildStorageKey({ businessId, fileId, fileName: sanitizedName });
  const now = Date.now();

  return {
    fileId,
    key,
    fileName: sanitizedName,
    mimeType: normalizeMimeType(mimeType),
    sizeBytes,
    expiresAt: new Date(now + expiresInMs).toISOString(),
    createdAt: nowIso(),
  };
}

export function isPendingUploadExpired(expiresAt) {
  return typeof expiresAt === 'string' && new Date(expiresAt).getTime() <= Date.now();
}

function normalizeMimeType(mimeType) {
  if (typeof mimeType !== 'string') return 'application/octet-stream';
  const trimmed = mimeType.trim().toLowerCase();
  return trimmed || 'application/octet-stream';
}

function getMaxSizeForMimeType(mimeType) {
  const normalizedMime = normalizeMimeType(mimeType);
  if (IMAGE_MIME_TYPES.has(normalizedMime)) return IMAGE_LIMIT_BYTES;
  if (normalizedMime === 'application/pdf') return PDF_LIMIT_BYTES;
  if (normalizedMime === 'text/csv') return CSV_LIMIT_BYTES;
  if (DOCUMENT_MIME_TYPES.has(normalizedMime)) return OFFICE_LIMIT_BYTES;
  return IMAGE_LIMIT_BYTES;
}

export function validateUploadPayload({ fileName, mimeType, sizeBytes }) {
  const normalizedMime = normalizeMimeType(mimeType);
  const allowedMimes = new Set([...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES]);
  allowedMimes.add('application/pdf');
  if (!allowedMimes.has(normalizedMime)) {
    return { ok: false, error: 'Unsupported file type.' };
  }

  const safeSize = Number(sizeBytes);
  if (!Number.isFinite(safeSize) || safeSize <= 0) {
    return { ok: false, error: 'Invalid file size.' };
  }

  const maxSize = getMaxSizeForMimeType(normalizedMime);
  if (safeSize > maxSize) {
    const limitLabel = maxSize >= 1024 * 1024 ? `${maxSize / (1024 * 1024)} MB` : `${maxSize} bytes`;
    return { ok: false, error: `File exceeds ${limitLabel} limit.` };
  }

  return { ok: true, fileName: sanitizeFilename(fileName), mimeType: normalizedMime, sizeBytes: safeSize };
}

function getS3Client() {
  const region = requireEnv('AWS_REGION');
  const endpoint = process.env.S3_ENDPOINT;
  const forcePathStyle = Boolean(process.env.S3_FORCE_PATH_STYLE);

  return new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
      : undefined,
  });
}

function getBucketName() {
  return requireEnv('S3_BUCKET_NAME');
}

function isStorageKeyScopedToBusiness({ businessId, key }) {
  return typeof key === 'string' && key.startsWith(`${businessId}/`);
}

export async function createPresignedUploadUrl({ businessId, fileName, mimeType, sizeBytes }) {
  const validation = validateUploadPayload({ fileName, mimeType, sizeBytes });
  if (!validation.ok) return { ok: false, error: validation.error };

  const plan = createPendingUploadPlan({ businessId, fileName: validation.fileName, mimeType: validation.mimeType, sizeBytes: validation.sizeBytes });
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: plan.key,
    ContentType: validation.mimeType,
    ContentLength: validation.sizeBytes,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });
  return { ok: true, uploadUrl, plan };
}

export async function createPresignedDownloadUrl({ businessId, key }) {
  if (!isStorageKeyScopedToBusiness({ businessId, key })) {
    return { ok: false, error: 'Unauthorized storage key.' };
  }

  const client = getS3Client();
  const command = new GetObjectCommand({ Bucket: getBucketName(), Key: key });
  return { ok: true, downloadUrl: await getSignedUrl(client, command, { expiresIn: 600 }) };
}

export async function removeStoredFile({ businessId, key }) {
  if (!isStorageKeyScopedToBusiness({ businessId, key })) {
    return { ok: false, error: 'Unauthorized storage key.' };
  }

  const client = getS3Client();
  const command = new DeleteObjectCommand({ Bucket: getBucketName(), Key: key });
  await client.send(command);
  return { ok: true };
}
