import bcrypt from 'bcryptjs';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddb, tableName } from './db.js';

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function businessPk(businessId) {
  return `BUSINESS#${businessId}`;
}

function userSk(userId) {
  return `USER#${userId}`;
}

function customerSk(customerId) {
  return `CUSTOMER#${customerId}`;
}

function jobSk(jobId) {
  return `JOB#${jobId}`;
}

function emailPk(email) {
  return `EMAIL#${normalizeEmail(email)}`;
}

function mapSessionUser(userItem, businessItem) {
  return {
    id: userItem.userId,
    businessId: userItem.businessId,
    name: userItem.name,
    email: userItem.email,
    role: userItem.role,
    businessName: businessItem.name,
  };
}

export async function createBusinessWithOwner({ businessName, ownerName, email, password }) {
  const businessId = generateId();
  const userId = generateId();
  const createdAt = nowIso();
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await bcrypt.hash(password, 10);

  const businessItem = {
    PK: businessPk(businessId),
    SK: 'PROFILE',
    entityType: 'BUSINESS',
    businessId,
    name: businessName.trim(),
    createdAt,
  };

  const userItem = {
    PK: businessPk(businessId),
    SK: userSk(userId),
    entityType: 'USER',
    userId,
    businessId,
    name: ownerName.trim(),
    email: normalizedEmail,
    role: 'owner',
    active: true,
    passwordHash,
    createdAt,
  };

  const emailLookupItem = {
    PK: emailPk(normalizedEmail),
    SK: 'USER',
    entityType: 'EMAIL_LOOKUP',
    businessId,
    userId,
    createdAt,
  };

  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName,
              Item: businessItem,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: userItem,
              ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: emailLookupItem,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
        ],
      })
    );
  } catch (error) {
    if (error?.name === 'TransactionCanceledException') {
      return { ok: false, error: 'An account with this email already exists.' };
    }
    throw error;
  }

  return { ok: true, user: mapSessionUser(userItem, businessItem) };
}

export async function authenticateUser(email, password) {
  const normalizedEmail = normalizeEmail(email);

  const lookup = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: emailPk(normalizedEmail),
        SK: 'USER',
      },
    })
  );

  if (!lookup.Item) {
    return { ok: false, error: 'Invalid email or password.' };
  }

  const userKey = {
    PK: businessPk(lookup.Item.businessId),
    SK: userSk(lookup.Item.userId),
  };

  const userRes = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: userKey,
    })
  );

  if (!userRes.Item || !userRes.Item.active) {
    return { ok: false, error: 'Invalid email or password.' };
  }

  const passwordOk = await bcrypt.compare(password, userRes.Item.passwordHash);
  if (!passwordOk) {
    return { ok: false, error: 'Invalid email or password.' };
  }

  const businessRes = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(userRes.Item.businessId),
        SK: 'PROFILE',
      },
    })
  );

  if (!businessRes.Item) {
    return { ok: false, error: 'Business account not found.' };
  }

  return {
    ok: true,
    user: mapSessionUser(userRes.Item, businessRes.Item),
  };
}

export async function listUsersForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'USER#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.userId,
    name: item.name,
    email: item.email,
    role: item.role,
    active: item.active,
    createdAt: item.createdAt,
  }));
}

export async function createUserForBusiness({ businessId, name, email, password, role }) {
  const normalizedEmail = normalizeEmail(email);
  const userId = generateId();
  const createdAt = nowIso();
  const passwordHash = await bcrypt.hash(password, 10);

  const userItem = {
    PK: businessPk(businessId),
    SK: userSk(userId),
    entityType: 'USER',
    userId,
    businessId,
    name: name.trim(),
    email: normalizedEmail,
    role,
    active: true,
    passwordHash,
    createdAt,
  };

  const emailLookupItem = {
    PK: emailPk(normalizedEmail),
    SK: 'USER',
    entityType: 'EMAIL_LOOKUP',
    businessId,
    userId,
    createdAt,
  };

  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName,
              Item: userItem,
              ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: emailLookupItem,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
        ],
      })
    );
  } catch (error) {
    if (error?.name === 'TransactionCanceledException') {
      return { ok: false, error: 'A user with this email already exists.' };
    }
    throw error;
  }

  return { ok: true };
}

export async function listCustomersForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'CUSTOMER#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.customerId,
    name: item.name,
    company: item.company,
    email: item.email,
    phone: item.phone,
    address: item.address,
    status: item.status,
    notes: item.notes,
    tags: item.tags ?? [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

export async function createCustomerForBusiness({ businessId, customer }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: customerSk(customer.id),
        entityType: 'CUSTOMER',
        businessId,
        customerId: customer.id,
        ...customer,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getCustomerForBusiness(businessId, customerId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: customerSk(customerId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.customerId,
        name: result.Item.name,
        company: result.Item.company,
        email: result.Item.email,
        phone: result.Item.phone,
        address: result.Item.address,
        status: result.Item.status,
        notes: result.Item.notes,
        tags: result.Item.tags ?? [],
        createdAt: result.Item.createdAt,
        updatedAt: result.Item.updatedAt,
      }
    : null;
}

export async function updateCustomerForBusiness({ businessId, customer }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: customerSk(customer.id),
        entityType: 'CUSTOMER',
        businessId,
        customerId: customer.id,
        ...customer,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteCustomerForBusiness(businessId, customerId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: customerSk(customerId),
      },
    })
  );

  return { ok: true };
}

export async function listJobsForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'JOB#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.jobId,
    estimateId: item.estimateId,
    customerId: item.customerId,
    title: item.title,
    description: item.description,
    status: item.status,
    startDate: item.startDate,
    endDate: item.endDate,
    estimatedHours: item.estimatedHours,
    actualHours: item.actualHours,
    estimatedCost: item.estimatedCost,
    actualCosts: item.actualCosts ?? [],
    contractValue: item.contractValue,
    assignedEmployeeIds: item.assignedEmployeeIds ?? [],
    notes: item.notes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

export async function createJobForBusiness({ businessId, job }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: jobSk(job.id),
        entityType: 'JOB',
        businessId,
        jobId: job.id,
        ...job,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getJobForBusiness(businessId, jobId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: jobSk(jobId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.jobId,
        estimateId: result.Item.estimateId,
        customerId: result.Item.customerId,
        title: result.Item.title,
        description: result.Item.description,
        status: result.Item.status,
        startDate: result.Item.startDate,
        endDate: result.Item.endDate,
        estimatedHours: result.Item.estimatedHours,
        actualHours: result.Item.actualHours,
        estimatedCost: result.Item.estimatedCost,
        actualCosts: result.Item.actualCosts ?? [],
        contractValue: result.Item.contractValue,
        assignedEmployeeIds: result.Item.assignedEmployeeIds ?? [],
        notes: result.Item.notes,
        createdAt: result.Item.createdAt,
        updatedAt: result.Item.updatedAt,
      }
    : null;
}

export async function updateJobForBusiness({ businessId, job }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: jobSk(job.id),
        entityType: 'JOB',
        businessId,
        jobId: job.id,
        ...job,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteJobForBusiness(businessId, jobId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: jobSk(jobId),
      },
    })
  );

  return { ok: true };
}
