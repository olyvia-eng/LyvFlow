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
  listFilesForBusiness,
} from './_lib/authRepo.js';

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

export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  if (req.method === 'POST') {
    const body = parseJsonBody(req);
    const { action, fileName, mimeType, sizeBytes, key, fileId } = body ?? {};

    if (action === 'prepare-upload') {
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
      const { fileId: incomingFileId, key: incomingKey, fileName: incomingFileName, mimeType: incomingMimeType, sizeBytes: incomingSizeBytes } = body ?? {};
      if (typeof incomingFileId !== 'string' || !incomingFileId || typeof incomingKey !== 'string' || !incomingKey) {
        return res.status(400).json({ ok: false, error: 'Invalid upload completion payload.' });
      }

      await createFileForBusiness({
        businessId: session.businessId,
        file: {
          id: incomingFileId,
          key: incomingKey,
          fileName: typeof incomingFileName === 'string' && incomingFileName ? incomingFileName : 'uploaded-file',
          mimeType: typeof incomingMimeType === 'string' && incomingMimeType ? incomingMimeType : 'application/octet-stream',
          sizeBytes: Number.isFinite(Number(incomingSizeBytes)) ? Number(incomingSizeBytes) : 0,
          uploadedAt: new Date().toISOString(),
          uploadedByUserId: session.id,
        },
      });

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
