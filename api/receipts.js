import { createReceiptForBusiness, getReceiptForBusiness } from './_lib/authRepo.js';
import { requireSession } from './_lib/session.js';

const MAX_RECEIPT_SIZE_BYTES = 2 * 1024 * 1024;

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeContentType(value) {
  if (typeof value !== 'string') return 'application/octet-stream';
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return 'application/octet-stream';
  if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(trimmed)) return 'application/octet-stream';
  return trimmed;
}

export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  if (req.method === 'POST') {
    const { fileName, mimeType, dataBase64 } = req.body ?? {};

    if (typeof fileName !== 'string' || typeof mimeType !== 'string' || typeof dataBase64 !== 'string') {
      return res.status(400).json({ ok: false, error: 'Invalid upload payload.' });
    }

    const trimmedData = dataBase64.trim();
    if (!trimmedData) {
      return res.status(400).json({ ok: false, error: 'Receipt file is empty.' });
    }

    const sizeBytes = Buffer.from(trimmedData, 'base64').byteLength;
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return res.status(400).json({ ok: false, error: 'Receipt file is invalid.' });
    }

    if (sizeBytes > MAX_RECEIPT_SIZE_BYTES) {
      return res.status(413).json({ ok: false, error: 'Receipt exceeds 2 MB limit.' });
    }

    const receiptId = generateId();

    try {
      await createReceiptForBusiness({
        businessId: session.businessId,
        receipt: {
          id: receiptId,
          fileName: fileName.trim() || 'receipt',
          mimeType: sanitizeContentType(mimeType),
          dataBase64: trimmedData,
          sizeBytes,
          uploadedAt: new Date().toISOString(),
        },
      });

      return res.status(200).json({ ok: true, receiptUrl: `/api/receipts?id=${receiptId}` });
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not upload receipt.' });
    }
  }

  if (req.method === 'GET') {
    const id = req.query.id;
    if (typeof id !== 'string' || !id) {
      return res.status(400).json({ ok: false, error: 'Invalid receipt id.' });
    }

    try {
      const receipt = await getReceiptForBusiness(session.businessId, id);
      if (!receipt) {
        return res.status(404).json({ ok: false, error: 'Receipt not found.' });
      }

      const binary = Buffer.from(receipt.dataBase64, 'base64');
      res.setHeader('Content-Type', receipt.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${receipt.fileName || 'receipt'}"`);
      return res.status(200).send(binary);
    } catch {
      return res.status(500).json({ ok: false, error: 'Could not load receipt.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
