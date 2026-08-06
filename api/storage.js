import { requireSession } from './_lib/session.js';
import {
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  removeStoredFile,
  validateUploadPayload,
} from './_lib/storage.js';
import {
  createAuditEventForBusiness,
  createFileForBusiness,
  deleteFileForBusiness,
  getExpenseForBusiness,
  getFileForBusiness,
  getTimeEntryForBusiness,
  listFilesForBusiness,
  updateExpenseForBusiness,
  updateTimeEntryForBusiness,
} from './_lib/authRepo.js';
import { canReadEntity, canWriteEntity } from './_lib/authorization.js';

const STORAGE_FAILURE_MESSAGE = 'Storage service is temporarily unavailable.';
const DOCUMENT_ENTITY_TYPE = 'document';
const DOCUMENT_ENTITY_ID = 'library';
const DOCUMENT_CATEGORIES = new Set([
  'contracts',
  'proposals',
  'permits',
  'insurance',
  'compliance',
  'photos',
  'misc',
]);

function parseJsonBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body ?? {};
}

function getSafeStatusCode(error) {
  const fromMetadata = Number(error?.$metadata?.httpStatusCode);
  if (Number.isFinite(fromMetadata) && fromMetadata >= 400 && fromMetadata < 600) {
    return fromMetadata;
  }

  const fromStatusCode = Number(error?.statusCode);
  if (Number.isFinite(fromStatusCode) && fromStatusCode >= 400 && fromStatusCode < 600) {
    return fromStatusCode;
  }

  return 503;
}

function logStorageFailure(action, error) {
  console.error('[storage:failure]', {
    action,
    errorName: error?.name,
    errorMessage: error?.message,
    httpStatusCode: error?.$metadata?.httpStatusCode ?? error?.statusCode ?? null,
  });
}

function getAttachmentFieldForCategory({ entityType, category }) {
  if (entityType === 'expense') {
    return category === 'receipt' ? 'receiptFileId' : undefined;
  }

  if (entityType === 'time-entry') {
    if (category === 'clock-in-photo') return 'clockInPhotoFileId';
    if (category === 'clock-out-photo') return 'clockOutPhotoFileId';
    return 'photoAttachmentFileId';
  }

  return undefined;
}

function canManageDocuments(role) {
  return role === 'owner' || role === 'admin';
}

function normalizeDocumentCategory(category) {
  if (typeof category !== 'string') return 'misc';
  const normalized = category.trim().toLowerCase();
  return DOCUMENT_CATEGORIES.has(normalized) ? normalized : 'misc';
}

async function resolveAttachmentEntity({ session, entityType, entityId }) {
  if (entityType === 'expense') {
    const expense = await getExpenseForBusiness(session.businessId, entityId);
    if (!expense) return null;
    return { entity: expense, allowed: canWriteEntity('expenses', session.role) || canReadEntity('expenses', session.role) };
  }

  if (entityType === 'time-entry') {
    const timeEntry = await getTimeEntryForBusiness(session.businessId, entityId);
    if (!timeEntry) return null;
    const role = session.role;
    if (role === 'crew_member') {
      return {
        entity: timeEntry,
        allowed: typeof session.employeeId === 'string' && timeEntry.employeeId === session.employeeId,
      };
    }
    return { entity: timeEntry, allowed: canWriteEntity('time-entries', role) || canReadEntity('time-entries', role) };
  }

  if (entityType === DOCUMENT_ENTITY_TYPE) {
    const normalizedEntityId = typeof entityId === 'string' && entityId.trim() ? entityId.trim() : DOCUMENT_ENTITY_ID;
    return {
      entity: { id: normalizedEntityId },
      allowed: canManageDocuments(session.role),
    };
  }

  return null;
}

const defaultDeps = {
  requireSession,
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  removeStoredFile,
  validateUploadPayload,
  createAuditEventForBusiness,
  createFileForBusiness,
  deleteFileForBusiness,
  getExpenseForBusiness,
  getFileForBusiness,
  getTimeEntryForBusiness,
  listFilesForBusiness,
  updateExpenseForBusiness,
  updateTimeEntryForBusiness,
};

export function createStorageHandler(overrides = {}) {
  const deps = { ...defaultDeps, ...overrides };

  async function resolveAttachmentEntityWithDeps({ session, entityType, entityId }) {
    if (entityType === 'expense') {
      const expense = await deps.getExpenseForBusiness(session.businessId, entityId);
      if (!expense) return null;
      return { entity: expense, allowed: canWriteEntity('expenses', session.role) || canReadEntity('expenses', session.role) };
    }

    if (entityType === 'time-entry') {
      const timeEntry = await deps.getTimeEntryForBusiness(session.businessId, entityId);
      if (!timeEntry) return null;
      const role = session.role;
      if (role === 'crew_member') {
        return {
          entity: timeEntry,
          allowed: typeof session.employeeId === 'string' && timeEntry.employeeId === session.employeeId,
        };
      }
      return { entity: timeEntry, allowed: canWriteEntity('time-entries', role) || canReadEntity('time-entries', role) };
    }

    if (entityType === DOCUMENT_ENTITY_TYPE) {
      const normalizedEntityId = typeof entityId === 'string' && entityId.trim() ? entityId.trim() : DOCUMENT_ENTITY_ID;
      return {
        entity: { id: normalizedEntityId },
        allowed: canManageDocuments(session.role),
      };
    }

    return null;
  }

  return async function handler(req, res) {
    const session = deps.requireSession(req, res);
    if (!session) return;

    if (req.method === 'POST') {
      const body = parseJsonBody(req);
      if (!body) {
        return res.status(400).json({ ok: false, error: 'Invalid JSON request body.' });
      }

      const { action, fileName, mimeType, sizeBytes, key } = body;

      try {
        if (action === 'prepare-upload') {
          const { entityType, entityId, category } = body;
          if (typeof entityType !== 'string' || typeof entityId !== 'string' || typeof category !== 'string') {
            return res.status(400).json({ ok: false, error: 'Attachment context is required.' });
          }

          const resolvedEntity = await resolveAttachmentEntityWithDeps({ session, entityType, entityId });
          if (!resolvedEntity?.entity || !resolvedEntity.allowed) {
            return res.status(403).json({ ok: false, error: 'Forbidden' });
          }

          const result = await deps.createPresignedUploadUrl({
            businessId: session.businessId,
            fileName,
            mimeType,
            sizeBytes,
          });

          if (!result.ok) {
            return res.status(400).json({ ok: false, error: result.error });
          }

          await deps.createAuditEventForBusiness({
            businessId: session.businessId,
            auditEvent: {
              id: `${Date.now()}-upload-plan`,
              entityType: 'FILE_UPLOAD',
              action: 'prepare-upload',
              userId: session.id,
              employeeId: session.employeeId,
              createdAt: new Date().toISOString(),
              details: { fileName: result.plan.fileName, mimeType: result.plan.mimeType, sizeBytes: result.plan.sizeBytes },
            },
          });

          return res.status(200).json({ ok: true, uploadUrl: result.uploadUrl, plan: result.plan });
        }

        if (action === 'prepare-download') {
          const fileIdValue = typeof body.fileId === 'string' ? body.fileId : undefined;
          if (fileIdValue) {
            const file = await deps.getFileForBusiness(session.businessId, fileIdValue);
            if (!file) {
              return res.status(404).json({ ok: false, error: 'File not found.' });
            }
            const entityResolution = await resolveAttachmentEntityWithDeps({ session, entityType: file.entityType, entityId: file.entityId });
            if (!entityResolution?.allowed) {
              return res.status(403).json({ ok: false, error: 'Forbidden' });
            }
            const result = await deps.createPresignedDownloadUrl({ businessId: session.businessId, key: file.key });
            if (!result.ok) {
              return res.status(400).json({ ok: false, error: result.error });
            }
            return res.status(200).json({ ok: true, downloadUrl: result.downloadUrl, key: file.key, fileId: file.id });
          }

          if (typeof key !== 'string' || !key) {
            return res.status(400).json({ ok: false, error: 'Invalid storage key.' });
          }

          const result = await deps.createPresignedDownloadUrl({ businessId: session.businessId, key });
          if (!result.ok) {
            return res.status(400).json({ ok: false, error: result.error });
          }

          return res.status(200).json({ ok: true, downloadUrl: result.downloadUrl, key });
        }

        if (action === 'delete') {
          if (typeof key !== 'string' || !key) {
            return res.status(400).json({ ok: false, error: 'Invalid storage key.' });
          }

          const result = await deps.removeStoredFile({ businessId: session.businessId, key });
          if (!result.ok) {
            return res.status(400).json({ ok: false, error: result.error });
          }

          await deps.deleteFileForBusiness(session.businessId, key.split('/')[1] ?? '');
          return res.status(200).json({ ok: true });
        }

        if (action === 'validate') {
          const result = deps.validateUploadPayload({ fileName, mimeType, sizeBytes });
          return res.status(result.ok ? 200 : 400).json(result);
        }

        if (action === 'complete-upload') {
          const {
            fileId: incomingFileId,
            key: incomingKey,
            fileName: incomingFileName,
            mimeType: incomingMimeType,
            sizeBytes: incomingSizeBytes,
            entityType,
            entityId,
            category,
          } = body;

          if (typeof incomingFileId !== 'string' || !incomingFileId || typeof incomingKey !== 'string' || !incomingKey) {
            return res.status(400).json({ ok: false, error: 'Invalid upload completion payload.' });
          }
          if (typeof entityType !== 'string' || typeof entityId !== 'string' || typeof category !== 'string') {
            return res.status(400).json({ ok: false, error: 'Attachment context is required.' });
          }

          const resolvedEntity = await resolveAttachmentEntityWithDeps({ session, entityType, entityId });
          if (!resolvedEntity?.entity || !resolvedEntity.allowed) {
            return res.status(403).json({ ok: false, error: 'Forbidden' });
          }

          const normalizedDocumentCategory = entityType === DOCUMENT_ENTITY_TYPE
            ? normalizeDocumentCategory(category)
            : category;
          const attachmentField = entityType === DOCUMENT_ENTITY_TYPE
            ? undefined
            : getAttachmentFieldForCategory({ entityType, category: normalizedDocumentCategory });
          if (entityType !== DOCUMENT_ENTITY_TYPE && !attachmentField) {
            return res.status(400).json({ ok: false, error: 'Unsupported attachment category.' });
          }

          await deps.createFileForBusiness({
            businessId: session.businessId,
            file: {
              id: incomingFileId,
              key: incomingKey,
              entityType,
              entityId,
              category: normalizedDocumentCategory,
              fileName: typeof incomingFileName === 'string' && incomingFileName ? incomingFileName : 'uploaded-file',
              mimeType: typeof incomingMimeType === 'string' && incomingMimeType ? incomingMimeType : 'application/octet-stream',
              sizeBytes: Number.isFinite(Number(incomingSizeBytes)) ? Number(incomingSizeBytes) : 0,
              uploadedAt: new Date().toISOString(),
              uploadedByUserId: session.id,
              uploadStatus: 'uploaded',
            },
          });

          if (entityType === 'expense') {
            const expense = await deps.getExpenseForBusiness(session.businessId, entityId);
            if (expense) {
              await deps.updateExpenseForBusiness({
                businessId: session.businessId,
                expense: {
                  ...expense,
                  id: expense.id,
                  receiptFileId: incomingFileId,
                  receiptUrl: undefined,
                },
              });
            }
          } else if (entityType === 'time-entry') {
            const timeEntry = await deps.getTimeEntryForBusiness(session.businessId, entityId);
            if (timeEntry) {
              await deps.updateTimeEntryForBusiness({
                businessId: session.businessId,
                timeEntry: {
                  ...timeEntry,
                  id: timeEntry.id,
                  [attachmentField]: incomingFileId,
                },
              });
            }
          }

          await deps.createAuditEventForBusiness({
            businessId: session.businessId,
            auditEvent: {
              id: `${Date.now()}-upload-complete`,
              entityType: 'FILE_UPLOAD',
              action: 'complete-upload',
              userId: session.id,
              employeeId: session.employeeId,
              createdAt: new Date().toISOString(),
              details: { fileId: incomingFileId, key: incomingKey, fileName: incomingFileName },
            },
          });

          return res.status(200).json({ ok: true, fileId: incomingFileId, key: incomingKey });
        }

        return res.status(400).json({ ok: false, error: 'Unsupported action.' });
      } catch (error) {
        logStorageFailure(action, error);
        return res.status(getSafeStatusCode(error)).json({ ok: false, error: STORAGE_FAILURE_MESSAGE });
      }
    }

    if (req.method === 'GET') {
      try {
        const view = req.query?.view;
        if (view === 'files') {
          const files = await deps.listFilesForBusiness(session.businessId);
          const entityTypeFilter = typeof req.query?.entityType === 'string' ? req.query.entityType.trim().toLowerCase() : '';
          const categoryFilter = typeof req.query?.category === 'string' ? req.query.category.trim().toLowerCase() : '';

          const scopedFiles = files.filter((file) => {
            if (entityTypeFilter && String(file.entityType || '').toLowerCase() !== entityTypeFilter) {
              return false;
            }
            if (categoryFilter && String(file.category || '').toLowerCase() !== categoryFilter) {
              return false;
            }
            return true;
          });

          return res.status(200).json({ ok: true, files: scopedFiles });
        }

        return res.status(200).json({ ok: true, message: 'Storage API is ready.' });
      } catch (error) {
        logStorageFailure('list-files', error);
        return res.status(getSafeStatusCode(error)).json({ ok: false, error: STORAGE_FAILURE_MESSAGE });
      }
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  };
}

export default createStorageHandler();
