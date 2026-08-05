import { requireSession } from './_lib/session.js';
import { createHash } from 'node:crypto';
import {
  buildClockInTransaction,
  buildClockOutTransaction,
  getActiveShiftForEmployee,
  getClockingErrorResponse,
  getClockingFailureResponse,
  getExistingClockingIdempotency,
  resolveClockOutActiveShift,
} from './_lib/clocking.js';
import { ddb, tableName } from './_lib/db.js';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { getEmployeeForBusiness, listTimeEntriesForBusiness } from './_lib/authRepo.js';
import { canClockForEmployee } from './_lib/authorization.js';

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

  if (!canClockForEmployee(session, employeeId)) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return { ok: true };
}

function getTimeEntryIdFromRequest(body) {
  if (typeof body?.entryId === 'string' && body.entryId.trim()) return body.entryId.trim();
  if (typeof body?.id === 'string' && body.id.trim()) return body.id.trim();
  return null;
}

function summarizeTransaction(tx) {
  return (tx?.TransactItems ?? []).map((item, index) => {
    const operationType = item.Put ? 'Put' : item.Delete ? 'Delete' : item.Update ? 'Update' : item.ConditionCheck ? 'ConditionCheck' : 'Unknown';
    return {
      index,
      operationType,
      PK: item.Put?.Item?.PK ?? item.Delete?.Key?.PK ?? item.Update?.Key?.PK ?? item.ConditionCheck?.Key?.PK ?? null,
      SK: item.Put?.Item?.SK ?? item.Delete?.Key?.SK ?? item.Update?.Key?.SK ?? item.ConditionCheck?.Key?.SK ?? null,
      ConditionExpression: item.Put?.ConditionExpression ?? item.Delete?.ConditionExpression ?? item.Update?.ConditionExpression ?? item.ConditionCheck?.ConditionExpression ?? null,
      UpdateExpression: item.Update?.UpdateExpression ?? null,
    };
  });
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
      const response = getClockingFailureResponse('clock-in', error);
      console.error('[clocking:clock-in]', {
        action: 'clock-in',
        name: error?.name,
        message: error?.message,
        httpStatusCode: error?.$metadata?.httpStatusCode,
        cancellationReasons: Array.isArray(error?.CancellationReasons)
          ? error.CancellationReasons.map((reason) => ({
              Code: reason?.Code ?? reason?.code,
              Message: typeof reason?.Message === 'string' ? reason.Message : undefined,
            }))
          : undefined,
      });
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

    if (!canClockForEmployee(session, activeEntry.employeeId)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const activeShift = await getActiveShiftForEmployee({
      businessId: session.businessId,
      employeeId: activeEntry.employeeId,
    });
    const activeShiftState = resolveClockOutActiveShift({
      activeShift,
      requestedEntryId: entryId,
    });

    if (!activeShiftState.ok) {
      if (activeShiftState.reason === 'missing-active-entry-id') {
        console.error('[clocking:clock-out:integrity]', {
          businessId: session.businessId,
          employeeId: activeEntry.employeeId,
          requestedEntryId: entryId,
          activeShiftActiveEntryId: activeShift?.activeEntryId ?? null,
          timeEntryFound: Boolean(activeEntry),
          timeEntryStatus: activeEntry?.status ?? null,
          reason: activeShiftState.reason,
        });
      } else if (activeShiftState.reason === 'entry-mismatch') {
        console.error('[clocking:clock-out:integrity]', {
          businessId: session.businessId,
          employeeId: activeEntry.employeeId,
          requestedEntryId: entryId,
          activeShiftActiveEntryId: activeShift?.activeEntryId ?? null,
          timeEntryFound: Boolean(activeEntry),
          timeEntryStatus: activeEntry?.status ?? null,
          reason: activeShiftState.reason,
        });
      }
      return res.status(activeShiftState.status).json({ ok: false, error: activeShiftState.error });
    }

    console.info('[clocking:clock-out:pre-transaction]', {
      businessId: session.businessId,
      employeeId: activeEntry.employeeId,
      requestedEntryId: entryId,
      activeShiftActiveEntryId: activeShift?.activeEntryId ?? null,
      timeEntryFound: Boolean(activeEntry),
      timeEntryStatus: activeEntry?.status ?? null,
    });

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
      const response = getClockingFailureResponse('clock-out', error);
      console.error('[clocking:clock-out]', {
        action: 'clock-out',
        name: error?.name,
        message: error?.message,
        code: error?.code,
        Code: error?.Code,
        httpStatusCode: error?.$metadata?.httpStatusCode,
        cancellationReasons: Array.isArray(error?.CancellationReasons)
          ? error.CancellationReasons.map((reason) => ({
              Code: reason?.Code ?? reason?.code,
              Message: typeof reason?.Message === 'string' ? reason.Message : undefined,
            }))
          : undefined,
        cancellationReasons: Array.isArray(error?.cancellationReasons)
          ? error.cancellationReasons.map((reason) => ({
              Code: reason?.Code ?? reason?.code,
              Message: typeof reason?.Message === 'string' ? reason.Message : undefined,
            }))
          : undefined,
        stack: error?.stack,
        transactionSummary: summarizeTransaction(tx),
      });
      return res.status(response.status).json({ ok: false, error: response.error });
    }
  }

  return res.status(400).json({ ok: false, error: 'Invalid clocking action' });
}
