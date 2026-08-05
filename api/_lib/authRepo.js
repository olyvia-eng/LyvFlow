import bcrypt from 'bcryptjs';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  ScanCommand,
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

function labourBudgetPlanSk(labourBudgetPlanId) {
  return `LABOUR_BUDGET#${labourBudgetPlanId}`;
}

function labourHoursSalesGoalSk(labourHoursSalesGoalId) {
  return `LABOUR_HOURS_GOAL#${labourHoursSalesGoalId}`;
}

function revenueSalesGoalSk(revenueSalesGoalId) {
  return `REVENUE_GOAL#${revenueSalesGoalId}`;
}

function employeeSk(employeeId) {
  return `EMPLOYEE#${employeeId}`;
}

function timeEntrySk(entryId) {
  return `TIME#${entryId}`;
}

function auditEventSk(eventId) {
  return `AUDIT#${eventId}`;
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

  let lookupItem = lookup.Item ?? null;

  if (!lookupItem) {
    const legacyLookup = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: 'entityType = :entityType AND email = :email',
        ExpressionAttributeValues: {
          ':entityType': 'USER',
          ':email': normalizedEmail,
        },
      })
    );

    lookupItem = legacyLookup.Items?.[0] ?? null;
  }

  if (!lookupItem) {
    return { ok: false, error: 'Invalid email or password.' };
  }

  const userKey = {
    PK: businessPk(lookupItem.businessId),
    SK: userSk(lookupItem.userId),
  };

  const userRes = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: userKey,
    })
  );

  if (!userRes.Item || userRes.Item.active === false) {
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

  if (!lookup.Item) {
    try {
      await ddb.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            PK: emailPk(normalizedEmail),
            SK: 'USER',
            entityType: 'EMAIL_LOOKUP',
            businessId: userRes.Item.businessId,
            userId: userRes.Item.userId,
            createdAt: nowIso(),
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        })
      );
    } catch {
      // Ignore backfill errors; login already succeeded.
    }
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
  const existing = await getBusinessUserById(businessId, user.id);
  if (!existing) {
    return { ok: false, error: 'User not found' };
  }

  const normalizedEmail = normalizeEmail(user.email);
  const previousEmail = normalizeEmail(existing.email);

  const userItem = {
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
  };

  if (previousEmail !== normalizedEmail) {
    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: tableName,
                Item: userItem,
                ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
              },
            },
            {
              Delete: {
                TableName: tableName,
                Key: {
                  PK: emailPk(previousEmail),
                  SK: 'USER',
                },
              },
            },
            {
              Put: {
                TableName: tableName,
                Item: {
                  PK: emailPk(normalizedEmail),
                  SK: 'USER',
                  entityType: 'EMAIL_LOOKUP',
                  businessId,
                  userId: user.id,
                  createdAt: nowIso(),
                },
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

  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: userItem,
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
    properties: Array.isArray(item.properties)
      ? item.properties
      : (item.address ? [item.address] : []),
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
        properties: Array.isArray(result.Item.properties)
          ? result.Item.properties
          : (result.Item.address ? [result.Item.address] : []),
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
    equipmentCostType: item.equipmentCostType === 'other' ? 'owned' : item.equipmentCostType,
    costCode: item.costCode,
    equipmentPayment: item.equipmentPayment,
    equipmentPaymentFrequencyPerYear: item.equipmentPaymentFrequencyPerYear,
    fuelPriceUnit: item.fuelPriceUnit,
    averageFuelPrice: item.averageFuelPrice,
    averageFuelBurnPerHour: item.averageFuelBurnPerHour,
    fuelCostPerHour: item.fuelCostPerHour,
    yearlyInsuranceCost: item.yearlyInsuranceCost ?? ((item.monthlyInsuranceCost ?? 0) * 12),
    yearlyMaintenanceCost: item.yearlyMaintenanceCost ?? ((item.monthlyMaintenanceCost ?? 0) * 12),
    equipmentHoursPerDay: item.equipmentHoursPerDay,
    monthlyInsuranceCost: item.monthlyInsuranceCost,
    monthlyMaintenanceCost: item.monthlyMaintenanceCost,
    sellableHoursPerYear: item.sellableHoursPerYear,
    actualMachineHoursPerYear: item.actualMachineHoursPerYear,
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
      equipmentCostType: result.Item.equipmentCostType === 'other' ? 'owned' : result.Item.equipmentCostType,
        costCode: result.Item.costCode,
        equipmentPayment: result.Item.equipmentPayment,
        equipmentPaymentFrequencyPerYear: result.Item.equipmentPaymentFrequencyPerYear,
        fuelPriceUnit: result.Item.fuelPriceUnit,
        averageFuelPrice: result.Item.averageFuelPrice,
        averageFuelBurnPerHour: result.Item.averageFuelBurnPerHour,
        fuelCostPerHour: result.Item.fuelCostPerHour,
        yearlyInsuranceCost: result.Item.yearlyInsuranceCost ?? ((result.Item.monthlyInsuranceCost ?? 0) * 12),
        yearlyMaintenanceCost: result.Item.yearlyMaintenanceCost ?? ((result.Item.monthlyMaintenanceCost ?? 0) * 12),
        equipmentHoursPerDay: result.Item.equipmentHoursPerDay,
        monthlyInsuranceCost: result.Item.monthlyInsuranceCost,
        monthlyMaintenanceCost: result.Item.monthlyMaintenanceCost,
        sellableHoursPerYear: result.Item.sellableHoursPerYear,
        actualMachineHoursPerYear: result.Item.actualMachineHoursPerYear,
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

export async function listLabourBudgetPlansForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'LABOUR_BUDGET#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.labourBudgetPlanId,
    employeeId: item.employeeId,
    year: item.year,
    compType: item.compType,
    roleTitle: item.roleTitle,
    hoursPerYear: item.hoursPerYear,
    billablePct: item.billablePct,
    payrollBurdenPct: item.payrollBurdenPct,
    benefitsExtraCost: item.benefitsExtraCost,
    bonus: item.bonus,
    billableHoursYear: item.billableHoursYear,
    unbillableHoursYear: item.unbillableHoursYear,
    overtimeHoursYear: item.overtimeHoursYear,
    overtimeMultiplier: item.overtimeMultiplier,
    hourlyRate: item.hourlyRate,
    annualSalary: item.annualSalary,
    labourBurdenPct: item.labourBurdenPct,
  }));
}

export async function createLabourBudgetPlanForBusiness({ businessId, labourBudgetPlan }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: labourBudgetPlanSk(labourBudgetPlan.id),
        entityType: 'LABOUR_BUDGET_PLAN',
        businessId,
        labourBudgetPlanId: labourBudgetPlan.id,
        ...labourBudgetPlan,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getLabourBudgetPlanForBusiness(businessId, labourBudgetPlanId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: labourBudgetPlanSk(labourBudgetPlanId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.labourBudgetPlanId,
        employeeId: result.Item.employeeId,
        year: result.Item.year,
        compType: result.Item.compType,
        roleTitle: result.Item.roleTitle,
        hoursPerYear: result.Item.hoursPerYear,
        billablePct: result.Item.billablePct,
        payrollBurdenPct: result.Item.payrollBurdenPct,
        benefitsExtraCost: result.Item.benefitsExtraCost,
        bonus: result.Item.bonus,
        billableHoursYear: result.Item.billableHoursYear,
        unbillableHoursYear: result.Item.unbillableHoursYear,
        overtimeHoursYear: result.Item.overtimeHoursYear,
        overtimeMultiplier: result.Item.overtimeMultiplier,
        hourlyRate: result.Item.hourlyRate,
        annualSalary: result.Item.annualSalary,
        labourBurdenPct: result.Item.labourBurdenPct,
      }
    : null;
}

export async function updateLabourBudgetPlanForBusiness({ businessId, labourBudgetPlan }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: labourBudgetPlanSk(labourBudgetPlan.id),
        entityType: 'LABOUR_BUDGET_PLAN',
        businessId,
        labourBudgetPlanId: labourBudgetPlan.id,
        ...labourBudgetPlan,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteLabourBudgetPlanForBusiness(businessId, labourBudgetPlanId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: labourBudgetPlanSk(labourBudgetPlanId),
      },
    })
  );

  return { ok: true };
}

export async function listLabourHoursSalesGoalsForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'LABOUR_HOURS_GOAL#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.labourHoursSalesGoalId,
    year: item.year,
    hoursGoal: item.hoursGoal,
  }));
}

export async function createLabourHoursSalesGoalForBusiness({ businessId, labourHoursSalesGoal }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: labourHoursSalesGoalSk(labourHoursSalesGoal.id),
        entityType: 'LABOUR_HOURS_SALES_GOAL',
        businessId,
        labourHoursSalesGoalId: labourHoursSalesGoal.id,
        ...labourHoursSalesGoal,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getLabourHoursSalesGoalForBusiness(businessId, labourHoursSalesGoalId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: labourHoursSalesGoalSk(labourHoursSalesGoalId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.labourHoursSalesGoalId,
        year: result.Item.year,
        hoursGoal: result.Item.hoursGoal,
      }
    : null;
}

export async function updateLabourHoursSalesGoalForBusiness({ businessId, labourHoursSalesGoal }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: labourHoursSalesGoalSk(labourHoursSalesGoal.id),
        entityType: 'LABOUR_HOURS_SALES_GOAL',
        businessId,
        labourHoursSalesGoalId: labourHoursSalesGoal.id,
        ...labourHoursSalesGoal,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteLabourHoursSalesGoalForBusiness(businessId, labourHoursSalesGoalId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: labourHoursSalesGoalSk(labourHoursSalesGoalId),
      },
    })
  );

  return { ok: true };
}

export async function listRevenueSalesGoalsForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'REVENUE_GOAL#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.revenueSalesGoalId,
    scopeType: item.scopeType,
    scopeValue: item.scopeValue,
    goalRevenue: item.goalRevenue,
    workingDays: item.workingDays,
  }));
}

export async function createRevenueSalesGoalForBusiness({ businessId, revenueSalesGoal }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: revenueSalesGoalSk(revenueSalesGoal.id),
        entityType: 'REVENUE_SALES_GOAL',
        businessId,
        revenueSalesGoalId: revenueSalesGoal.id,
        ...revenueSalesGoal,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getRevenueSalesGoalForBusiness(businessId, revenueSalesGoalId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: revenueSalesGoalSk(revenueSalesGoalId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.revenueSalesGoalId,
        scopeType: result.Item.scopeType,
        scopeValue: result.Item.scopeValue,
        goalRevenue: result.Item.goalRevenue,
        workingDays: result.Item.workingDays,
      }
    : null;
}

export async function updateRevenueSalesGoalForBusiness({ businessId, revenueSalesGoal }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: revenueSalesGoalSk(revenueSalesGoal.id),
        entityType: 'REVENUE_SALES_GOAL',
        businessId,
        revenueSalesGoalId: revenueSalesGoal.id,
        ...revenueSalesGoal,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteRevenueSalesGoalForBusiness(businessId, revenueSalesGoalId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: revenueSalesGoalSk(revenueSalesGoalId),
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
    compensationType: item.compensationType ?? 'hourly',
    labourType: item.labourType ?? 'field_producing',
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
        compensationType: result.Item.compensationType ?? 'hourly',
        labourType: result.Item.labourType ?? 'field_producing',
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
    jobId: item.jobId ?? (Array.isArray(item.jobIds) ? item.jobIds[0] : undefined),
    jobIds: Array.isArray(item.jobIds)
      ? item.jobIds
      : (item.jobId ? [item.jobId] : []),
    workType: item.workType ?? 'job',
    clockIn: item.clockIn,
    breakMinutes: item.breakMinutes ?? 0,
    notes: item.notes ?? '',
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
        jobId: result.Item.jobId ?? (Array.isArray(result.Item.jobIds) ? result.Item.jobIds[0] : undefined),
        jobIds: Array.isArray(result.Item.jobIds)
          ? result.Item.jobIds
          : (result.Item.jobId ? [result.Item.jobId] : []),
        workType: result.Item.workType ?? 'job',
        clockIn: result.Item.clockIn,
        clockOut: result.Item.clockOut,
        breakMinutes: result.Item.breakMinutes ?? 0,
        notes: result.Item.notes ?? '',
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

export async function listAuditEventsForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'AUDIT#',
      },
    })
  );

  return (result.Items ?? [])
    .map((item) => ({
      id: item.eventId,
      action: item.action,
      actorUserId: item.actorUserId,
      actorName: item.actorName,
      actorEmail: item.actorEmail,
      affectedEntryCount: item.affectedEntryCount,
      createdAt: item.createdAt,
      metadata: item.metadata ?? {},
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createAuditEventForBusiness({ businessId, auditEvent }) {
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

  return { ok: true };
}

export async function getAuditEventForBusiness(businessId, eventId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: auditEventSk(eventId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.eventId,
        action: result.Item.action,
        actorUserId: result.Item.actorUserId,
        actorName: result.Item.actorName,
        actorEmail: result.Item.actorEmail,
        affectedEntryCount: result.Item.affectedEntryCount,
        createdAt: result.Item.createdAt,
        metadata: result.Item.metadata ?? {},
      }
    : null;
}

export async function updateAuditEventForBusiness({ businessId, auditEvent }) {
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
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteAuditEventForBusiness(businessId, eventId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: auditEventSk(eventId),
      },
    })
  );

  return { ok: true };
}
