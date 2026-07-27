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

function estimateSk(estimateId) {
  return `ESTIMATE#${estimateId}`;
}

function templateSk(templateId) {
  return `TEMPLATE#${templateId}`;
}

function budgetSk(budgetItemId) {
  return `BUDGET#${budgetItemId}`;
}

function employeeSk(employeeId) {
  return `EMPLOYEE#${employeeId}`;
}

function timeEntrySk(entryId) {
  return `TIME#${entryId}`;
}

function emailPk(email) {
  return `EMAIL#${normalizeEmail(email)}`;
}
function normalizeBusinessRole(role) {
  if (role === 'employee') return 'crew_member';
  return role;
}

function normalizeEmployeeRole(role) {
  if (role === 'worker' || role === 'subcontractor') return 'crew_member';
  return role;
}

function mapSessionUser(userItem, businessItem) {
  return {
    id: userItem.userId,
    businessId: userItem.businessId,
    name: userItem.name,
    email: userItem.email,
    role: normalizeBusinessRole(userItem.role),
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
    role: normalizeBusinessRole(item.role),
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

export async function getBusinessUserById(businessId, userId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: userSk(userId),
      },
    })
  );

  if (!result.Item) return null;

  return {
    id: result.Item.userId,
    businessId: result.Item.businessId,
    name: result.Item.name,
    email: result.Item.email,
    role: normalizeBusinessRole(result.Item.role),
    active: result.Item.active,
    createdAt: result.Item.createdAt,
    passwordHash: result.Item.passwordHash,
  };
}

export async function updateBusinessUser({ businessId, user }) {
  const normalizedEmail = normalizeEmail(user.email);

  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: userSk(user.id),
        entityType: 'USER',
        userId: user.id,
        businessId,
        name: user.name,
        email: normalizedEmail,
        role: user.role,
        active: user.active,
        passwordHash: user.passwordHash,
        createdAt: user.createdAt,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteBusinessUser(businessId, userId) {
  const existing = await getBusinessUserById(businessId, userId);
  if (!existing) {
    return { ok: false, error: 'User not found' };
  }

  if (existing.role === 'owner') {
    return { ok: false, error: 'Owner account cannot be deleted.' };
  }

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: tableName,
            Key: {
              PK: businessPk(businessId),
              SK: userSk(userId),
            },
          },
        },
        {
          Delete: {
            TableName: tableName,
            Key: {
              PK: emailPk(existing.email),
              SK: 'USER',
            },
          },
        },
      ],
    })
  );

  return { ok: true };
}

export async function deleteAuthUserForBusinessByEmail(businessId, email) {
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

  if (!lookup.Item || lookup.Item.businessId !== businessId) {
    return { ok: true };
  }

  const userRes = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: userSk(lookup.Item.userId),
      },
    })
  );

  if (!userRes.Item) {
    return { ok: true };
  }

  if (userRes.Item.role === 'owner') {
    return { ok: false, error: 'Owner auth user cannot be deleted from employee removal.' };
  }

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: tableName,
            Key: {
              PK: businessPk(businessId),
              SK: userSk(lookup.Item.userId),
            },
          },
        },
        {
          Delete: {
            TableName: tableName,
            Key: {
              PK: emailPk(normalizedEmail),
              SK: 'USER',
            },
          },
        },
      ],
    })
  );

  return { ok: true };
}

export async function listTemplatesForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'TEMPLATE#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.templateId,
    name: item.name,
    description: item.description,
    lineItems: item.lineItems ?? [],
    taxRate: item.taxRate,
    notes: item.notes,
    createdAt: item.createdAt,
  }));
}

export async function createTemplateForBusiness({ businessId, template }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: templateSk(template.id),
        entityType: 'ESTIMATE_TEMPLATE',
        businessId,
        templateId: template.id,
        ...template,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getTemplateForBusiness(businessId, templateId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: templateSk(templateId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.templateId,
        name: result.Item.name,
        description: result.Item.description,
        lineItems: result.Item.lineItems ?? [],
        taxRate: result.Item.taxRate,
        notes: result.Item.notes,
        createdAt: result.Item.createdAt,
      }
    : null;
}

export async function updateTemplateForBusiness({ businessId, template }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: templateSk(template.id),
        entityType: 'ESTIMATE_TEMPLATE',
        businessId,
        templateId: template.id,
        ...template,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteTemplateForBusiness(businessId, templateId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: templateSk(templateId),
      },
    })
  );

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

export async function listEstimatesForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'ESTIMATE#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.estimateId,
    customerId: item.customerId,
    title: item.title,
    description: item.description,
    status: item.status,
    lineItems: item.lineItems ?? [],
    taxRate: item.taxRate,
    notes: item.notes,
    validUntil: item.validUntil,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    sentAt: item.sentAt,
    templateId: item.templateId,
  }));
}

export async function createEstimateForBusiness({ businessId, estimate }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: estimateSk(estimate.id),
        entityType: 'ESTIMATE',
        businessId,
        estimateId: estimate.id,
        ...estimate,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getEstimateForBusiness(businessId, estimateId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: estimateSk(estimateId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.estimateId,
        customerId: result.Item.customerId,
        title: result.Item.title,
        description: result.Item.description,
        status: result.Item.status,
        lineItems: result.Item.lineItems ?? [],
        taxRate: result.Item.taxRate,
        notes: result.Item.notes,
        validUntil: result.Item.validUntil,
        createdAt: result.Item.createdAt,
        updatedAt: result.Item.updatedAt,
        sentAt: result.Item.sentAt,
        templateId: result.Item.templateId,
      }
    : null;
}

export async function updateEstimateForBusiness({ businessId, estimate }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: estimateSk(estimate.id),
        entityType: 'ESTIMATE',
        businessId,
        estimateId: estimate.id,
        ...estimate,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteEstimateForBusiness(businessId, estimateId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: estimateSk(estimateId),
      },
    })
  );

  return { ok: true };
}

export async function listBudgetItemsForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'BUDGET#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.budgetItemId,
    category: item.category,
    description: item.description,
    budgeted: item.budgeted,
    actual: item.actual,
    period: item.period,
  }));
}

export async function createBudgetItemForBusiness({ businessId, budgetItem }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: budgetSk(budgetItem.id),
        entityType: 'BUDGET_ITEM',
        businessId,
        budgetItemId: budgetItem.id,
        ...budgetItem,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getBudgetItemForBusiness(businessId, budgetItemId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: budgetSk(budgetItemId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.budgetItemId,
        category: result.Item.category,
        description: result.Item.description,
        budgeted: result.Item.budgeted,
        actual: result.Item.actual,
        period: result.Item.period,
      }
    : null;
}

export async function updateBudgetItemForBusiness({ businessId, budgetItem }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: budgetSk(budgetItem.id),
        entityType: 'BUDGET_ITEM',
        businessId,
        budgetItemId: budgetItem.id,
        ...budgetItem,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteBudgetItemForBusiness(businessId, budgetItemId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: budgetSk(budgetItemId),
      },
    })
  );

  return { ok: true };
}

export async function listEmployeesForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'EMPLOYEE#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.employeeId,
    name: item.name,
    email: item.email,
    phone: item.phone,
    role: item.role,
    hourlyRate: item.hourlyRate,
    active: item.active,
    createdAt: item.createdAt,
  }));
}

export async function createEmployeeForBusiness({ businessId, employee }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: employeeSk(employee.id),
        entityType: 'EMPLOYEE',
        businessId,
        employeeId: employee.id,
        ...employee,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getEmployeeForBusiness(businessId, employeeId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: employeeSk(employeeId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.employeeId,
        name: result.Item.name,
        email: result.Item.email,
        phone: result.Item.phone,
        role: normalizeEmployeeRole(result.Item.role),
        hourlyRate: result.Item.hourlyRate,
        active: result.Item.active,
        createdAt: result.Item.createdAt,
      }
    : null;
}

export async function updateEmployeeForBusiness({ businessId, employee }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: employeeSk(employee.id),
        entityType: 'EMPLOYEE',
        businessId,
        employeeId: employee.id,
        ...employee,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteEmployeeForBusiness(businessId, employeeId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: employeeSk(employeeId),
      },
    })
  );

  return { ok: true };
}

export async function listTimeEntriesForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'TIME#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.entryId,
    employeeId: item.employeeId,
    jobId: item.jobId,
    clockIn: item.clockIn,
    role: normalizeEmployeeRole(item.role),
    breakMinutes: item.breakMinutes,
    notes: item.notes,
    status: item.status,
  }));
}

export async function createTimeEntryForBusiness({ businessId, timeEntry }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: timeEntrySk(timeEntry.id),
        entityType: 'TIME_ENTRY',
        businessId,
        entryId: timeEntry.id,
        ...timeEntry,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getTimeEntryForBusiness(businessId, entryId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: timeEntrySk(entryId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.entryId,
        employeeId: result.Item.employeeId,
        jobId: result.Item.jobId,
        clockIn: result.Item.clockIn,
        clockOut: result.Item.clockOut,
        breakMinutes: result.Item.breakMinutes,
        notes: result.Item.notes,
        status: result.Item.status,
      }
    : null;
}

export async function updateTimeEntryForBusiness({ businessId, timeEntry }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: timeEntrySk(timeEntry.id),
        entityType: 'TIME_ENTRY',
        businessId,
        entryId: timeEntry.id,
        ...timeEntry,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteTimeEntryForBusiness(businessId, entryId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: timeEntrySk(entryId),
      },
    })
  );

  return { ok: true };
}
