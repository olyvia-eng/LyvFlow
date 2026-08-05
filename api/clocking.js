import { requireSession } from './_lib/session.js';
import { createHash } from 'node:crypto';
import {
  buildClockInTransaction,
  buildClockOutTransaction,
  getClockingErrorResponse,
  getExistingClockingIdempotency,
} from './_lib/clocking.js';
import { ddb, tableName } from './_lib/db.js';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { getEmployeeForBusiness, listTimeEntriesForBusiness } from './_lib/authRepo.js';

function nowIso() {
  return new Date().toISOString();
}

function payloadHash(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function ensureClockingEmployee(session, employeeId) {
  if (typeof employeeId !== 'string' || employeeId.trim().length === 0) {
    return { ok: false, status: 400, error: 'Employee is required.' };
  }
  return { ok: true };
}

function getTimeEntryIdFromRequest(body) {
  if (typeof body?.entryId === 'string' && body.entryId.trim()) return body.entryId.trim();
  if (typeof body?.id === 'string' && body.id.trim()) return body.id.trim();
  return null;
}

export default async function handler(req, res) {
  const session = requireSession(req, res, ['owner', 'admin', 'crew_member']);
  if (!session) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const action = req.query.action;
  if (action === 'clock-in') {
    const validation = ensureClockingEmployee(session, req.body?.employeeId);
    if (!validation.ok) {
      return res.status(validation.status).json({ ok: false, error: validation.error });
    }

    const employeeId = req.body.employeeId;
    const employee = await getEmployeeForBusiness(session.businessId, employeeId);
    if (!employee || !employee.active) {
      return res.status(400).json({ ok: false, error: 'Employee is invalid.' });
    }

    const requestId = typeof req.body?.requestId === 'string' && req.body.requestId.trim()
      ? req.body.requestId.trim()
      : `${session.id}:${nowIso()}`;
    const idempotencyKey = typeof req.body?.idempotencyKey === 'string' && req.body.idempotencyKey.trim()
      ? req.body.idempotencyKey.trim()
      : `${employeeId}:${requestId}`;
    const payload = {
      action: 'clock-in',
      employeeId,
      workType: req.body?.workType ?? 'job',
      jobIds: Array.isArray(req.body?.jobIds) ? req.body.jobIds.filter(Boolean) : [],
      requestId,
      idempotencyKey,
    };
    const hashedPayload = payloadHash(payload);

    const existing = await getExistingClockingIdempotency({ businessId: session.businessId, idempotencyKey });
    if (existing) {
      return res.status(200).json({ ok: true, timeEntry: existing.response });
    }

    const activeEntries = await listTimeEntriesForBusiness(session.businessId);
    const activeEntry = activeEntries.find((entry) => entry.employeeId === employeeId && entry.status === 'clocked_in');
    if (activeEntry) {
      const response = getClockingErrorResponse({ statusCode: 409, code: 'ALREADY_CLOCKED_IN' });
      return res.status(response.status).json({ ok: false, error: response.error });
    }

    const clockInAt = nowIso();
    const tx = buildClockInTransaction({
      businessId: session.businessId,
      employeeId,
      userId: session.id,
      timeEntryId: `${employeeId}:${clockInAt}`,
      clockInAt,
      requestId,
      idempotencyKey,
      payloadHash: hashedPayload,
      source: 'web',
      auditEventId: `${session.id}:${clockInAt}`,
      jobIds: Array.isArray(req.body?.jobIds) ? req.body.jobIds.filter(Boolean) : [],
      workType: req.body?.workType ?? 'job',
      employeeName: employee.name,
    });

    try {
      await ddb.send(new TransactWriteCommand(tx));
      const timeEntry = {
        id: `${employeeId}:${clockInAt}`,
        employeeId,
        jobId: Array.isArray(req.body?.jobIds) && req.body.jobIds.length > 0 ? req.body.jobIds[0] : undefined,
        jobIds: Array.isArray(req.body?.jobIds) ? req.body.jobIds.filter(Boolean) : [],
        workType: req.body?.workType ?? 'job',
        clockIn: clockInAt,
        breakMinutes: 0,
        notes: '',
        status: 'clocked_in',
      };
      return res.status(200).json({ ok: true, timeEntry });
    } catch (error) {
      const code = error?.name === 'TransactionCanceledException' ? 'ALREADY_CLOCKED_IN' : undefined;
      const response = getClockingErrorResponse({ statusCode: 409, code });
      return res.status(response.status).json({ ok: false, error: response.error });
    }
  }

  if (action === 'clock-out') {
    const entryId = getTimeEntryIdFromRequest(req.body);
    if (!entryId) {
      return res.status(400).json({ ok: false, error: 'Entry id is required.' });
    }

    const requestId = typeof req.body?.requestId === 'string' && req.body.requestId.trim()
      ? req.body.requestId.trim()
      : `${session.id}:${nowIso()}`;
    const idempotencyKey = typeof req.body?.idempotencyKey === 'string' && req.body.idempotencyKey.trim()
      ? req.body.idempotencyKey.trim()
      : `${entryId}:${requestId}`;
    const payload = {
      action: 'clock-out',
      entryId,
      requestId,
      idempotencyKey,
      breakMinutes: req.body?.breakMinutes ?? 0,
      notes: req.body?.notes ?? '',
      photoAttachmentUrl: req.body?.photoAttachmentUrl ?? undefined,
    };
    const hashedPayload = payloadHash(payload);

    const existing = await getExistingClockingIdempotency({ businessId: session.businessId, idempotencyKey });
    if (existing) {
      return res.status(200).json({ ok: true, timeEntry: existing.response });
    }

    const activeEntries = await listTimeEntriesForBusiness(session.businessId);
    const activeEntry = activeEntries.find((entry) => entry.id === entryId && entry.status === 'clocked_in');
    if (!activeEntry) {
      const response = getClockingErrorResponse({ statusCode: 409, code: 'NO_ACTIVE_SHIFT' });
      return res.status(response.status).json({ ok: false, error: response.error });
    }

    const employee = await getEmployeeForBusiness(session.businessId, activeEntry.employeeId);
    const clockOutAt = nowIso();
    const tx = buildClockOutTransaction({
      businessId: session.businessId,
      employeeId: activeEntry.employeeId,
      userId: session.id,
      timeEntryId: entryId,
      clockOutAt,
      requestId,
      idempotencyKey,
      payloadHash: hashedPayload,
      source: 'web',
      auditEventId: `${session.id}:${clockOutAt}`,
      breakMinutes: req.body?.breakMinutes ?? 0,
      notes: req.body?.notes ?? '',
      photoAttachmentUrl: req.body?.photoAttachmentUrl ?? undefined,
      employeeName: employee?.name ?? '',
    });

    try {
      await ddb.send(new TransactWriteCommand(tx));
      const timeEntry = {
        id: entryId,
        employeeId: activeEntry.employeeId,
        jobId: activeEntry.jobId,
        jobIds: activeEntry.jobIds,
        workType: activeEntry.workType,
        clockIn: activeEntry.clockIn,
        clockOut: clockOutAt,
        breakMinutes: req.body?.breakMinutes ?? 0,
        notes: req.body?.notes ?? '',
        photoAttachmentUrl: req.body?.photoAttachmentUrl ?? undefined,
        status: 'clocked_out',
      };
      return res.status(200).json({ ok: true, timeEntry });
    } catch (error) {
      const response = getClockingErrorResponse({ statusCode: 409, code: error?.name === 'TransactionCanceledException' ? 'NO_ACTIVE_SHIFT' : undefined });
      return res.status(response.status).json({ ok: false, error: response.error });
    }
  }

  return res.status(400).json({ ok: false, error: 'Invalid clocking action' });
}
