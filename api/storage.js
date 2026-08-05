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

  return null;
}

export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  if (req.method === 'POST') {
    const body = parseJsonBody(req);
    const { action, fileName, mimeType, sizeBytes, key, fileId } = body ?? {};

    if (action === 'prepare-upload') {
      const { entityType, entityId, category } = body ?? {};
      if (typeof entityType !== 'string' || typeof entityId !== 'string' || typeof category !== 'string') {
        return res.status(400).json({ ok: false, error: 'Attachment context is required.' });
      }

      const resolvedEntity = await resolveAttachmentEntity({ session, entityType, entityId });
      if (!resolvedEntity?.entity || !resolvedEntity.allowed) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }

      const result = await createPresignedUploadUrl({
        businessId: session.businessId,
        fileName,
        mimeType,
        sizeBytes,
      });

      if (!result.ok) {
        return res.status(400).json({ ok: false, error: result.error });
      }

      await createAuditEventForBusiness({
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
      const fileIdValue = typeof body?.fileId === 'string' ? body.fileId : undefined;
      if (fileIdValue) {
        const file = await getFileForBusiness(session.businessId, fileIdValue);
        if (!file) {
          return res.status(404).json({ ok: false, error: 'File not found.' });
        }
        const entityResolution = await resolveAttachmentEntity({ session, entityType: file.entityType, entityId: file.entityId });
        if (!entityResolution?.allowed) {
          return res.status(403).json({ ok: false, error: 'Forbidden' });
        }
        const result = await createPresignedDownloadUrl({ businessId: session.businessId, key: file.key });
        if (!result.ok) {
          return res.status(400).json({ ok: false, error: result.error });
        }
        return res.status(200).json({ ok: true, downloadUrl: result.downloadUrl, key: file.key, fileId: file.id });
      }

      if (typeof key !== 'string' || !key) {
        return res.status(400).json({ ok: false, error: 'Invalid storage key.' });
      }

      const result = await createPresignedDownloadUrl({ businessId: session.businessId, key });
      if (!result.ok) {
        return res.status(400).json({ ok: false, error: result.error });
      }

      return res.status(200).json({ ok: true, downloadUrl: result.downloadUrl, key });
    }

    if (action === 'delete') {
      if (typeof key !== 'string' || !key) {
        return res.status(400).json({ ok: false, error: 'Invalid storage key.' });
      }

      const result = await removeStoredFile({ businessId: session.businessId, key });
      if (!result.ok) {
        return res.status(400).json({ ok: false, error: result.error });
      }

      await deleteFileForBusiness(session.businessId, key.split('/')[1] ?? '');
      return res.status(200).json({ ok: true });
    }

    if (action === 'validate') {
      const result = validateUploadPayload({ fileName, mimeType, sizeBytes });
      return res.status(result.ok ? 200 : 400).json(result);
    }

    if (action === 'complete-upload') {
      const { fileId: incomingFileId, key: incomingKey, fileName: incomingFileName, mimeType: incomingMimeType, sizeBytes: incomingSizeBytes, entityType, entityId, category } = body ?? {};
      if (typeof incomingFileId !== 'string' || !incomingFileId || typeof incomingKey !== 'string' || !incomingKey) {
        return res.status(400).json({ ok: false, error: 'Invalid upload completion payload.' });
      }
      if (typeof entityType !== 'string' || typeof entityId !== 'string' || typeof category !== 'string') {
        return res.status(400).json({ ok: false, error: 'Attachment context is required.' });
      }

      const resolvedEntity = await resolveAttachmentEntity({ session, entityType, entityId });
      if (!resolvedEntity?.entity || !resolvedEntity.allowed) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }

      const attachmentField = getAttachmentFieldForCategory({ entityType, category });
      if (!attachmentField) {
        return res.status(400).json({ ok: false, error: 'Unsupported attachment category.' });
      }

      await createFileForBusiness({
        businessId: session.businessId,
        file: {
          id: incomingFileId,
          key: incomingKey,
          entityType,
          entityId,
          category,
          fileName: typeof incomingFileName === 'string' && incomingFileName ? incomingFileName : 'uploaded-file',
          mimeType: typeof incomingMimeType === 'string' && incomingMimeType ? incomingMimeType : 'application/octet-stream',
          sizeBytes: Number.isFinite(Number(incomingSizeBytes)) ? Number(incomingSizeBytes) : 0,
          uploadedAt: new Date().toISOString(),
          uploadedByUserId: session.id,
        },
      });

      if (entityType === 'expense') {
        const expense = await getExpenseForBusiness(session.businessId, entityId);
        if (expense) {
          await updateExpenseForBusiness({
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
        const timeEntry = await getTimeEntryForBusiness(session.businessId, entityId);
        if (timeEntry) {
          await updateTimeEntryForBusiness({
            businessId: session.businessId,
            timeEntry: {
              ...timeEntry,
              id: timeEntry.id,
              [attachmentField]: incomingFileId,
            },
          });
        }
      }

      await createAuditEventForBusiness({
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
  }

  if (req.method === 'GET') {
    const view = req.query?.view;
    if (view === 'files') {
      const files = await listFilesForBusiness(session.businessId);
      return res.status(200).json({ ok: true, files });
    }

    return res.status(200).json({ ok: true, message: 'Storage API is ready.' });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
