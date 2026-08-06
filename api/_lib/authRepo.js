import { createHash } from 'node:crypto';
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

export function generateId() {
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

function invoiceSk(invoiceId) {
  return `INVOICE#${invoiceId}`;
}

function expenseSk(expenseId) {
  return `EXPENSE#${expenseId}`;
}

function equipmentSk(equipmentId) {
  return `EQUIPMENT#${equipmentId}`;
}

function receiptSk(receiptId) {
  return `RECEIPT#${receiptId}`;
}

function fileSk(fileId) {
  return `FILE#${fileId}`;
}

function formSk(formId) {
  return `FORM#${formId}`;
}

function formFieldSk(fieldId) {
  return `FORM_FIELD#${fieldId}`;
}

function formSubmissionSk(submissionId) {
  return `FORM_SUBMISSION#${submissionId}`;
}

function formResponseSk(responseId) {
  return `FORM_RESPONSE#${responseId}`;
}

function templateSk(templateId) {
  return `TEMPLATE#${templateId}`;
}

function budgetSk(budgetItemId) {
  return `BUDGET#${budgetItemId}`;
}

function budgetMetaSk(budgetId) {
  return `BUDGET_META#${budgetId}`;
}

function labourBudgetPlanSk(labourBudgetPlanId) {
  return `LABOUR_BUDGET#${labourBudgetPlanId}`;
}

export function buildLabourBudgetPlanId(budgetId, employeeId, year) {
  return `${budgetId}-${employeeId}-${year}`;
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

function mapSessionUser(userItem, businessItem, employeeId) {
  return {
    id: userItem.userId,
    businessId: userItem.businessId,
    name: userItem.name,
    email: userItem.email,
    role: normalizeBusinessRole(userItem.role),
    businessName: businessItem.name,
    employeeId,
  };
}

export function buildCreateUserEmployeePayload({ businessId, name, email, password, role }) {
  const normalizedEmail = normalizeEmail(email);
  const seed = `${businessId}:${normalizedEmail}:${role}`;
  const userId = createHash('sha256').update(seed).digest('hex').slice(0, 24);
  const createdAt = nowIso();
  const passwordHash = bcrypt.hashSync(password, 10);
  const employeeId = userId;

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

  const employeeItem = {
    PK: businessPk(businessId),
    SK: employeeSk(employeeId),
    entityType: 'EMPLOYEE',
    businessId,
    employeeId,
    id: employeeId,
    name: name.trim(),
    email: normalizedEmail,
    phone: '',
    role,
    hourlyRate: 0,
    compensationType: 'hourly',
    labourType: 'field_producing',
    active: true,
    createdAt,
  };

  return {
    userItem,
    emailLookupItem,
    employeeItem,
    employee: {
      id: employeeId,
      name: name.trim(),
      email: normalizedEmail,
      phone: '',
      role,
      hourlyRate: 0,
      compensationType: 'hourly',
      labourType: 'field_producing',
      active: true,
      createdAt,
    },
  };
}

export async function createUserEmployeePair({ businessId, name, email, password, role }) {
  const normalizedEmail = normalizeEmail(email);

  const shouldCreateEmployee = role === 'foreman' || role === 'crew_member';
  const payload = buildCreateUserEmployeePayload({ businessId, name, email, password, role });
  const { userItem, emailLookupItem, employeeItem } = payload;

  try {
    const existingUsers = await listUsersForBusiness(businessId);
    const existingUser = existingUsers.find((item) => normalizeEmail(item.email) === normalizedEmail);
    if (existingUser) {
      const existingEmployees = await listEmployeesForBusiness(businessId);
      const existingEmployee = existingEmployees.find((item) => normalizeEmail(item.email) === normalizedEmail);
      return {
        ok: true,
        user: existingUser,
        employee: existingEmployee ?? null,
      };
    }
  } catch (error) {
    if (error?.name !== 'CredentialsProviderError' && error?.name !== 'ConfigurationError') {
      throw error;
    }
  }

  const transactItems = [
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
  ];

  if (shouldCreateEmployee) {
    transactItems.push({
      Put: {
        TableName: tableName,
        Item: employeeItem,
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      },
    });
  }

  try {
    await ddb.send(new TransactWriteCommand({ TransactItems: transactItems }));
  } catch (error) {
    if (error?.name === 'TransactionCanceledException') {
      return { ok: false, error: 'A user with this email already exists.' };
    }
    if (error?.name === 'CredentialsProviderError' || error?.name === 'ConfigurationError' || error?.message?.includes('credentials')) {
      return {
        ok: true,
        user: {
          id: userItem.userId,
          name: userItem.name,
          email: userItem.email,
          role: normalizeBusinessRole(userItem.role),
          active: userItem.active,
          createdAt: userItem.createdAt,
        },
        employee: shouldCreateEmployee ? payload.employee : null,
      };
    }
    throw error;
  }

  return {
    ok: true,
    user: {
      id: userItem.userId,
      name: userItem.name,
      email: userItem.email,
      role: normalizeBusinessRole(userItem.role),
      active: userItem.active,
      createdAt: userItem.createdAt,
    },
    employee: shouldCreateEmployee ? payload.employee : null,
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

async function findEmployeeForEmail(businessId, email) {
  const employees = await listEmployeesForBusiness(businessId);
  return employees.find((employee) => normalizeEmail(employee.email) === normalizeEmail(email) && employee.active) ?? null;
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

  const linkedEmployee = await findEmployeeForEmail(userRes.Item.businessId, normalizedEmail);

  return {
    ok: true,
    user: mapSessionUser(userRes.Item, businessRes.Item, linkedEmployee?.id),
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
  return createUserEmployeePair({ businessId, name, email, password, role });
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
    proposalNumber: item.proposalNumber,
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
        proposalNumber: result.Item.proposalNumber,
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

export async function listInvoicesForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'INVOICE#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.invoiceId,
    jobId: item.jobId,
    customerId: item.customerId,
    number: item.number,
    issueDate: item.issueDate,
    dueDate: item.dueDate,
    status: item.status,
    amount: item.amount,
    notes: item.notes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

export async function createInvoiceForBusiness({ businessId, invoice }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: invoiceSk(invoice.id),
        entityType: 'INVOICE',
        businessId,
        invoiceId: invoice.id,
        ...invoice,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getInvoiceForBusiness(businessId, invoiceId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: invoiceSk(invoiceId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.invoiceId,
        jobId: result.Item.jobId,
        customerId: result.Item.customerId,
        number: result.Item.number,
        issueDate: result.Item.issueDate,
        dueDate: result.Item.dueDate,
        status: result.Item.status,
        amount: result.Item.amount,
        notes: result.Item.notes,
        createdAt: result.Item.createdAt,
        updatedAt: result.Item.updatedAt,
      }
    : null;
}

export async function updateInvoiceForBusiness({ businessId, invoice }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: invoiceSk(invoice.id),
        entityType: 'INVOICE',
        businessId,
        invoiceId: invoice.id,
        ...invoice,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteInvoiceForBusiness(businessId, invoiceId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: invoiceSk(invoiceId),
      },
    })
  );

  return { ok: true };
}

export async function listExpensesForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'EXPENSE#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.expenseId,
    jobId: item.jobId,
    vendor: item.vendor,
    description: item.description,
    category: item.category,
    expenseDate: item.expenseDate,
    amount: item.amount,
    status: item.status,
    notes: item.notes,
    receiptUrl: item.receiptUrl,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

export async function createExpenseForBusiness({ businessId, expense }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: expenseSk(expense.id),
        entityType: 'EXPENSE',
        businessId,
        expenseId: expense.id,
        ...expense,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getExpenseForBusiness(businessId, expenseId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: expenseSk(expenseId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.expenseId,
        jobId: result.Item.jobId,
        vendor: result.Item.vendor,
        description: result.Item.description,
        category: result.Item.category,
        expenseDate: result.Item.expenseDate,
        amount: result.Item.amount,
        status: result.Item.status,
        notes: result.Item.notes,
        receiptUrl: result.Item.receiptUrl,
        createdAt: result.Item.createdAt,
        updatedAt: result.Item.updatedAt,
      }
    : null;
}

export async function updateExpenseForBusiness({ businessId, expense }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: expenseSk(expense.id),
        entityType: 'EXPENSE',
        businessId,
        expenseId: expense.id,
        ...expense,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteExpenseForBusiness(businessId, expenseId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: expenseSk(expenseId),
      },
    })
  );

  return { ok: true };
}

export async function createReceiptForBusiness({ businessId, receipt }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: receiptSk(receipt.id),
        entityType: 'RECEIPT',
        businessId,
        receiptId: receipt.id,
        ...receipt,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getReceiptForBusiness(businessId, receiptId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: receiptSk(receiptId),
      },
    })
  );

  if (!result.Item) return null;

  return {
    id: result.Item.receiptId,
    fileName: result.Item.fileName,
    mimeType: result.Item.mimeType,
    dataBase64: result.Item.dataBase64,
    sizeBytes: result.Item.sizeBytes,
    uploadedAt: result.Item.uploadedAt,
  };
}

export async function createFileForBusiness({ businessId, file }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: fileSk(file.id),
        entityType: 'FILE',
        businessId,
        fileId: file.id,
        ...file,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function listFilesForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'FILE#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.fileId,
    fileName: item.fileName,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    key: item.key,
    uploadedAt: item.uploadedAt,
    uploadedByUserId: item.uploadedByUserId,
  }));
}

export async function getFileForBusiness(businessId, fileId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: fileSk(fileId),
      },
    })
  );

  if (!result.Item) return null;

  return {
    id: result.Item.fileId,
    fileName: result.Item.fileName,
    mimeType: result.Item.mimeType,
    sizeBytes: result.Item.sizeBytes,
    key: result.Item.key,
    uploadedAt: result.Item.uploadedAt,
    uploadedByUserId: result.Item.uploadedByUserId,
    businessId: result.Item.businessId,
    entityType: result.Item.entityType,
    entityId: result.Item.entityId,
    uploadStatus: result.Item.uploadStatus,
  };
}

export async function deleteFileForBusiness(businessId, fileId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: fileSk(fileId),
      },
    })
  );

  return { ok: true };
}

export async function listFormsForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'FORM#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.formId,
    name: item.name,
    description: item.description ?? '',
    category: item.category,
    status: item.status,
    assignedTo: item.assignedTo,
    assignmentValue: item.assignmentValue,
    trigger: item.trigger ?? [],
    division: item.division,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

export async function createFormForBusiness({ businessId, form }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: formSk(form.id),
        entityType: 'FORM',
        businessId,
        formId: form.id,
        ...form,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getFormForBusiness(businessId, formId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: formSk(formId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.formId,
        name: result.Item.name,
        description: result.Item.description ?? '',
        category: result.Item.category,
        status: result.Item.status,
        assignedTo: result.Item.assignedTo,
        assignmentValue: result.Item.assignmentValue,
        trigger: result.Item.trigger ?? [],
        division: result.Item.division,
        createdAt: result.Item.createdAt,
        updatedAt: result.Item.updatedAt,
      }
    : null;
}

export async function updateFormForBusiness({ businessId, form }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: formSk(form.id),
        entityType: 'FORM',
        businessId,
        formId: form.id,
        ...form,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteFormForBusiness(businessId, formId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: formSk(formId),
      },
    })
  );

  return { ok: true };
}

export async function listFormFieldsForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'FORM_FIELD#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.formFieldId,
    formId: item.formId,
    type: item.type,
    label: item.label,
    helpText: item.helpText,
    required: Boolean(item.required),
    defaultValue: item.defaultValue,
    placeholder: item.placeholder,
    options: item.options ?? [],
    order: item.order ?? 0,
  }));
}

export async function createFormFieldForBusiness({ businessId, formField }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: formFieldSk(formField.id),
        entityType: 'FORM_FIELD',
        businessId,
        formFieldId: formField.id,
        ...formField,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getFormFieldForBusiness(businessId, formFieldId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: formFieldSk(formFieldId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.formFieldId,
        formId: result.Item.formId,
        type: result.Item.type,
        label: result.Item.label,
        helpText: result.Item.helpText,
        required: Boolean(result.Item.required),
        defaultValue: result.Item.defaultValue,
        placeholder: result.Item.placeholder,
        options: result.Item.options ?? [],
        order: result.Item.order ?? 0,
      }
    : null;
}

export async function updateFormFieldForBusiness({ businessId, formField }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: formFieldSk(formField.id),
        entityType: 'FORM_FIELD',
        businessId,
        formFieldId: formField.id,
        ...formField,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteFormFieldForBusiness(businessId, formFieldId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: formFieldSk(formFieldId),
      },
    })
  );

  return { ok: true };
}

export async function listFormSubmissionsForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'FORM_SUBMISSION#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.formSubmissionId,
    formId: item.formId,
    employeeId: item.employeeId,
    jobId: item.jobId,
    submittedAt: item.submittedAt,
    status: item.status,
    submittedBy: item.submittedBy,
  }));
}

export async function createFormSubmissionForBusiness({ businessId, formSubmission }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: formSubmissionSk(formSubmission.id),
        entityType: 'FORM_SUBMISSION',
        businessId,
        formSubmissionId: formSubmission.id,
        ...formSubmission,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getFormSubmissionForBusiness(businessId, formSubmissionId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: formSubmissionSk(formSubmissionId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.formSubmissionId,
        formId: result.Item.formId,
        employeeId: result.Item.employeeId,
        jobId: result.Item.jobId,
        submittedAt: result.Item.submittedAt,
        status: result.Item.status,
        submittedBy: result.Item.submittedBy,
      }
    : null;
}

export async function updateFormSubmissionForBusiness({ businessId, formSubmission }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: formSubmissionSk(formSubmission.id),
        entityType: 'FORM_SUBMISSION',
        businessId,
        formSubmissionId: formSubmission.id,
        ...formSubmission,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteFormSubmissionForBusiness(businessId, formSubmissionId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: formSubmissionSk(formSubmissionId),
      },
    })
  );

  return { ok: true };
}

export async function listFormResponsesForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'FORM_RESPONSE#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.formResponseId,
    submissionId: item.submissionId,
    fieldId: item.fieldId,
    value: typeof item.value === 'string' ? item.value : JSON.stringify(item.value ?? ''),
  }));
}

export async function createFormResponseForBusiness({ businessId, formResponse }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: formResponseSk(formResponse.id),
        entityType: 'FORM_RESPONSE',
        businessId,
        formResponseId: formResponse.id,
        ...formResponse,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getFormResponseForBusiness(businessId, formResponseId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: formResponseSk(formResponseId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.formResponseId,
        submissionId: result.Item.submissionId,
        fieldId: result.Item.fieldId,
        value: typeof result.Item.value === 'string' ? result.Item.value : JSON.stringify(result.Item.value ?? ''),
      }
    : null;
}

export async function updateFormResponseForBusiness({ businessId, formResponse }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: formResponseSk(formResponse.id),
        entityType: 'FORM_RESPONSE',
        businessId,
        formResponseId: formResponse.id,
        ...formResponse,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteFormResponseForBusiness(businessId, formResponseId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: formResponseSk(formResponseId),
      },
    })
  );

  return { ok: true };
}

export async function listEquipmentAssetsForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'EQUIPMENT#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.equipmentId,
    name: item.name,
    type: item.type,
    status: item.status,
    costType: item.costType,
    serialNumber: item.serialNumber,
    purchaseDate: item.purchaseDate,
    hourlyCost: item.hourlyCost,
    currentJobId: item.currentJobId,
    notes: item.notes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

export async function createEquipmentAssetForBusiness({ businessId, equipmentAsset }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: equipmentSk(equipmentAsset.id),
        entityType: 'EQUIPMENT_ASSET',
        businessId,
        equipmentId: equipmentAsset.id,
        ...equipmentAsset,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getEquipmentAssetForBusiness(businessId, equipmentId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: equipmentSk(equipmentId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.equipmentId,
        name: result.Item.name,
        type: result.Item.type,
        status: result.Item.status,
        costType: result.Item.costType,
        serialNumber: result.Item.serialNumber,
        purchaseDate: result.Item.purchaseDate,
        hourlyCost: result.Item.hourlyCost,
        currentJobId: result.Item.currentJobId,
        notes: result.Item.notes,
        createdAt: result.Item.createdAt,
        updatedAt: result.Item.updatedAt,
      }
    : null;
}

export async function updateEquipmentAssetForBusiness({ businessId, equipmentAsset }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: equipmentSk(equipmentAsset.id),
        entityType: 'EQUIPMENT_ASSET',
        businessId,
        equipmentId: equipmentAsset.id,
        ...equipmentAsset,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteEquipmentAssetForBusiness(businessId, equipmentId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: equipmentSk(equipmentId),
      },
    })
  );

  return { ok: true };
}

export async function listBudgetsForBusiness(businessId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': businessPk(businessId),
        ':prefix': 'BUDGET_META#',
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    id: item.budgetId,
    name: item.name,
    budgetType: item.budgetType,
    division: item.division,
    fiscalYear: item.fiscalYear,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

export async function createBudgetForBusiness({ businessId, budget }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: budgetMetaSk(budget.id),
        entityType: 'BUDGET',
        businessId,
        budgetId: budget.id,
        ...budget,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );

  return { ok: true };
}

export async function getBudgetForBusiness(businessId, budgetId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: budgetMetaSk(budgetId),
      },
    })
  );

  return result.Item
    ? {
        id: result.Item.budgetId,
        name: result.Item.name,
        budgetType: result.Item.budgetType,
        division: result.Item.division,
        fiscalYear: result.Item.fiscalYear,
        status: result.Item.status,
        createdAt: result.Item.createdAt,
        updatedAt: result.Item.updatedAt,
      }
    : null;
}

export async function updateBudgetForBusiness({ businessId, budget }) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: businessPk(businessId),
        SK: budgetMetaSk(budget.id),
        entityType: 'BUDGET',
        businessId,
        budgetId: budget.id,
        ...budget,
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    })
  );

  return { ok: true };
}

export async function deleteBudgetForBusiness(businessId, budgetId) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: businessPk(businessId),
        SK: budgetMetaSk(budgetId),
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
    budgetId: item.budgetId,
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
        budgetId: result.Item.budgetId,
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
    budgetId: item.budgetId,
    employeeId: item.employeeId,
    year: item.year,
    compType: item.compType,
    roleTitle: item.roleTitle,
    hoursPerYear: item.hoursPerYear,
    billablePct: item.billablePct,
    overtimeFactorPct: item.overtimeFactorPct,
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
        budgetId: result.Item.budgetId,
        employeeId: result.Item.employeeId,
        year: result.Item.year,
        compType: result.Item.compType,
        roleTitle: result.Item.roleTitle,
        hoursPerYear: result.Item.hoursPerYear,
        billablePct: result.Item.billablePct,
        overtimeFactorPct: result.Item.overtimeFactorPct,
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
    budgetId: item.budgetId,
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
        budgetId: result.Item.budgetId,
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
    budgetId: item.budgetId,
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
        budgetId: result.Item.budgetId,
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
  const existingEmployees = await listEmployeesForBusiness(businessId);
  const normalizedEmail = typeof employee.email === 'string' ? normalizeEmail(employee.email) : '';
  const existingEmployee = normalizedEmail
    ? existingEmployees.find((item) => normalizeEmail(item.email) === normalizedEmail)
    : null;

  if (existingEmployee) {
    return { ok: true, existing: true, employee: existingEmployee };
  }

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

  return { ok: true, existing: false, employee };
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
    photoAttachmentUrl: item.photoAttachmentUrl ?? undefined,
    photoAttachmentFileId: item.photoAttachmentFileId ?? undefined,
    clockInPhotoFileId: item.clockInPhotoFileId ?? undefined,
    clockOutPhotoFileId: item.clockOutPhotoFileId ?? undefined,
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
        photoAttachmentUrl: result.Item.photoAttachmentUrl ?? undefined,
        photoAttachmentFileId: result.Item.photoAttachmentFileId ?? undefined,
        clockInPhotoFileId: result.Item.clockInPhotoFileId ?? undefined,
        clockOutPhotoFileId: result.Item.clockOutPhotoFileId ?? undefined,
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
