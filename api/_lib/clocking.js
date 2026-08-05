import { DeleteCommand, GetCommand, PutCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, tableName } from './db.js';

function nowIso() {
  return new Date().toISOString();
}

function businessPk(businessId) {
  return `BUSINESS#${businessId}`;
}

function activeShiftPk(businessId, employeeId) {
  return `${businessPk(businessId)}#EMPLOYEE#${employeeId}`;
}

function activeShiftSk() {
  return 'ACTIVE_SHIFT';
}

function timeEntrySk(entryId) {
  return `TIME#${entryId}`;
}

function idempotencySk(idempotencyKey) {
  return `IDEMPOTENCY#${idempotencyKey}`;
}

function auditEventSk(eventId) {
  return `AUDIT#${eventId}`;
}

function buildClockingPayload({ action, businessId, employeeId, employeeName, userId, timeEntryId, clockInAt, clockOutAt, workType, jobIds, breakMinutes, notes, photoAttachmentUrl, source }) {
  return {
    action,
    businessId,
    employeeId,
    employeeName,
    userId,
    timeEntryId,
    clockInAt,
    clockOutAt,
    workType,
    jobIds,
    breakMinutes,
    notes,
    photoAttachmentUrl,
    source,
  };
}

export function buildClockInTransaction({
  businessId,
  employeeId,
  userId,
  timeEntryId,
  clockInAt,
  requestId,
  idempotencyKey,
  payloadHash,
  source,
  auditEventId,
  jobIds = [],
  workType = 'job',
  employeeName = '',
}) {
  const now = clockInAt ?? nowIso();
  const timeEntryItem = {
    PK: businessPk(businessId),
    SK: timeEntrySk(timeEntryId),
    entityType: 'TIME_ENTRY',
    businessId,
    entryId: timeEntryId,
    employeeId,
    employeeName,
    jobId: Array.isArray(jobIds) && jobIds.length > 0 ? jobIds[0] : undefined,
    jobIds: Array.isArray(jobIds) ? jobIds : [],
    workType,
    clockIn: now,
    status: 'clocked_in',
    breakMinutes: 0,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };

  const lockItem = {
    PK: activeShiftPk(businessId, employeeId),
    SK: activeShiftSk(),
    entityType: 'ACTIVE_SHIFT',
    businessId,
    employeeId,
    activeEntryId: timeEntryId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  const auditItem = {
    PK: businessPk(businessId),
    SK: auditEventSk(auditEventId),
    entityType: 'AUDIT_EVENT',
    businessId,
    eventId: auditEventId,
    action: 'clock_in',
    actorUserId: userId,
    actorName: employeeName || userId,
    actorEmail: '',
    affectedEntryCount: 1,
    createdAt: now,
    metadata: {
      employeeId,
      timeEntryId,
      source,
    },
  };

  const idempotencyItem = {
    PK: businessPk(businessId),
    SK: idempotencySk(idempotencyKey),
    entityType: 'IDEMPOTENCY',
    businessId,
    requestId,
    idempotencyKey,
    action: 'clock_in',
    payloadHash,
    status: 'completed',
    response: {
      id: timeEntryId,
      employeeId,
      jobIds: Array.isArray(jobIds) ? jobIds : [],
      workType,
      clockIn: now,
      breakMinutes: 0,
      notes: '',
      status: 'clocked_in',
    },
    createdAt: now,
    updatedAt: now,
  };

  return {
    TransactItems: [
      {
        Put: {
          TableName: tableName,
          Item: idempotencyItem,
          ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        },
      },
      {
        ConditionCheck: {
          TableName: tableName,
          Key: {
            PK: activeShiftPk(businessId, employeeId),
            SK: activeShiftSk(),
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      {
        Put: {
          TableName: tableName,
          Item: lockItem,
          ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        },
      },
      {
        Put: {
          TableName: tableName,
          Item: timeEntryItem,
          ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        },
      },
      {
        Put: {
          TableName: tableName,
          Item: auditItem,
          ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        },
      },
    ],
  };
}

export function buildClockOutTransaction({
  businessId,
  employeeId,
  userId,
  timeEntryId,
  clockOutAt,
  requestId,
  idempotencyKey,
  payloadHash,
  source,
  auditEventId,
  breakMinutes = 0,
  notes = '',
  photoAttachmentUrl,
  employeeName = '',
}) {
  const now = clockOutAt ?? nowIso();
  const idempotencyItem = {
    PK: businessPk(businessId),
    SK: idempotencySk(idempotencyKey),
    entityType: 'IDEMPOTENCY',
    businessId,
    requestId,
    idempotencyKey,
    action: 'clock_out',
    payloadHash,
    status: 'completed',
    response: {
      id: timeEntryId,
      employeeId,
      clockOut: now,
      breakMinutes,
      notes,
      photoAttachmentUrl: photoAttachmentUrl || undefined,
      status: 'clocked_out',
    },
    createdAt: now,
    updatedAt: now,
  };

  const auditItem = {
    PK: businessPk(businessId),
    SK: auditEventSk(auditEventId),
    entityType: 'AUDIT_EVENT',
    businessId,
    eventId: auditEventId,
    action: 'clock_out',
    actorUserId: userId,
    actorName: employeeName || userId,
    actorEmail: '',
    affectedEntryCount: 1,
    createdAt: now,
    metadata: {
      employeeId,
      timeEntryId,
      source,
    },
  };

  return {
    TransactItems: [
      {
        Put: {
          TableName: tableName,
          Item: idempotencyItem,
          ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        },
      },
      {
        ConditionCheck: {
          TableName: tableName,
          Key: {
            PK: activeShiftPk(businessId, employeeId),
            SK: activeShiftSk(),
          },
          ConditionExpression: 'attribute_exists(PK)',
        },
      },
      {
        ConditionCheck: {
          TableName: tableName,
          Key: {
            PK: businessPk(businessId),
            SK: timeEntrySk(timeEntryId),
          },
          ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
        },
      },
      {
        Update: {
          TableName: tableName,
          Key: {
            PK: businessPk(businessId),
            SK: timeEntrySk(timeEntryId),
          },
          UpdateExpression: 'SET #status = :status, #clockOut = :clockOut, #breakMinutes = :breakMinutes, #notes = :notes, #photoAttachmentUrl = :photoAttachmentUrl, #updatedAt = :updatedAt',
          ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#clockOut': 'clockOut',
            '#breakMinutes': 'breakMinutes',
            '#notes': 'notes',
            '#photoAttachmentUrl': 'photoAttachmentUrl',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':status': 'clocked_out',
            ':clockOut': now,
            ':breakMinutes': breakMinutes,
            ':notes': notes,
            ':photoAttachmentUrl': photoAttachmentUrl || undefined,
            ':updatedAt': now,
          },
        },
      },
      {
        Delete: {
          TableName: tableName,
          Key: {
            PK: activeShiftPk(businessId, employeeId),
            SK: activeShiftSk(),
          },
        },
      },
      {
        Put: {
          TableName: tableName,
          Item: auditItem,
          ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        },
      },
    ],
  };
}

export function getClockingErrorResponse(error) {
  const code = error?.code;
  if (code === 'ALREADY_CLOCKED_IN') {
    return { status: 409, error: 'Already Clocked In' };
  }
  if (code === 'NO_ACTIVE_SHIFT') {
    return { status: 409, error: 'No active shift found' };
  }
  if (code === 'ALREADY_CLOCKED_OUT') {
    return { status: 409, error: 'Already Clocked Out' };
  }
  if (error?.statusCode === 409) {
    return { status: 409, error: error?.error ?? 'Conflict' };
  }
  return { status: error?.statusCode ?? 400, error: error?.error ?? 'Clocking request failed' };
}

export async function getExistingClockingIdempotency({ businessId, idempotencyKey }) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: idempotencySk(idempotencyKey),
      },
    })
  );

  return result.Item ?? null;
}

export async function persistClockingIdempotency({ businessId, idempotencyKey, response, action, requestId, payloadHash }) {
  const now = nowIso();
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: idempotencySk(idempotencyKey),
        entityType: 'IDEMPOTENCY',
        businessId,
        requestId,
        idempotencyKey,
        action,
        payloadHash,
        response,
        status: 'completed',
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );
}

export async function createClockingAuditEvent({ businessId, auditEvent }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: auditEventSk(auditEvent.id),
        entityType: 'AUDIT_EVENT',
        businessId,
        eventId: auditEvent.id,
        ...auditEvent,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );
}

export async function deleteActiveShiftLock({ businessId, employeeId }) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: activeShiftPk(businessId, employeeId),
        SK: activeShiftSk(),
      },
    })
  );
}
