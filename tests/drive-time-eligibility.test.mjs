import test from 'node:test';
import assert from 'node:assert/strict';

import dataHandler from '../api/data.js';
import clockingHandler, { canRecordDriveTime } from '../api/clocking.js';
import { ddb } from '../api/_lib/db.js';
import {
  createMobileSessionForUser,
  createEmployeeForBusiness,
  getEmployeeForBusiness,
  listTimeEntriesForBusiness,
} from '../api/_lib/authRepo.js';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
}

function mapKey(pk, sk) {
  return `${pk}|${sk}`;
}

function installDdbMock(t) {
  const store = new Map();
  const originalSend = ddb.send.bind(ddb);

  ddb.send = async (command) => {
    const commandType = command?.constructor?.name;
    const input = command?.input ?? {};

    if (commandType === 'PutCommand') {
      const item = { ...input.Item };
      store.set(mapKey(item.PK, item.SK), item);
      return {};
    }

    if (commandType === 'GetCommand') {
      const key = mapKey(input.Key.PK, input.Key.SK);
      return { Item: store.get(key) };
    }

    if (commandType === 'DeleteCommand') {
      const key = mapKey(input.Key.PK, input.Key.SK);
      store.delete(key);
      return {};
    }

    if (commandType === 'UpdateCommand') {
      const key = mapKey(input.Key.PK, input.Key.SK);
      const existing = store.get(key);
      if (!existing) {
        const error = new Error('Conditional check failed');
        error.name = 'ConditionalCheckFailedException';
        throw error;
      }

      const next = {
        ...existing,
        revokedAt: input.ExpressionAttributeValues[':revokedAt'],
        updatedAt: input.ExpressionAttributeValues[':updatedAt'],
      };
      store.set(key, next);
      return {};
    }

    if (commandType === 'QueryCommand') {
      const pk = input.ExpressionAttributeValues[':pk'];
      const prefix = input.ExpressionAttributeValues[':prefix'];
      const items = [];
      for (const item of store.values()) {
        if (item.PK === pk && typeof item.SK === 'string' && item.SK.startsWith(prefix)) {
          items.push(item);
        }
      }
      return { Items: items };
    }

    if (commandType === 'TransactWriteCommand') {
      return {};
    }

    return originalSend(command);
  };

  t.after(() => {
    ddb.send = originalSend;
  });

  return store;
}

function seedBusinessUser(store, { businessId, userId, role = 'admin', email = 'admin@example.com' }) {
  store.set(
    mapKey(`BUSINESS#${businessId}`, `USER#${userId}`),
    {
      PK: `BUSINESS#${businessId}`,
      SK: `USER#${userId}`,
      entityType: 'USER',
      businessId,
      userId,
      name: 'Auth User',
      email,
      role,
      active: true,
      passwordHash: 'hash',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
  );
}

async function createBearerTokenForUser({ businessId, userId, role, email, employeeId, token }) {
  await createMobileSessionForUser({
    user: {
      id: userId,
      businessId,
      name: 'Auth User',
      email,
      role,
      businessName: 'OliveOps Demo',
      employeeId,
    },
    accessToken: token,
    expiresInSeconds: 604800,
  });
}

test('employee setting defaults to false when field is missing', async (t) => {
  installDdbMock(t);

  await createEmployeeForBusiness({
    businessId: 'biz-default',
    employee: {
      id: 'emp-default',
      name: 'Default Employee',
      email: 'default@example.com',
      phone: '',
      role: 'crew_member',
      hourlyRate: 30,
      compensationType: 'hourly',
      labourType: 'field_producing',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  });

  const employee = await getEmployeeForBusiness('biz-default', 'emp-default');
  assert.equal(employee.paidDriveTimeEnabled, false);
});

test('owner/admin can enable and disable paid drive time via employee update endpoint', async (t) => {
  const store = installDdbMock(t);
  seedBusinessUser(store, {
    businessId: 'biz-eligibility',
    userId: 'user-admin',
    role: 'admin',
    email: 'admin@example.com',
  });

  await createEmployeeForBusiness({
    businessId: 'biz-eligibility',
    employee: {
      id: 'emp-1',
      name: 'Eligible Employee',
      email: 'emp1@example.com',
      phone: '',
      role: 'crew_member',
      hourlyRate: 28,
      compensationType: 'hourly',
      labourType: 'field_producing',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  });

  await createBearerTokenForUser({
    businessId: 'biz-eligibility',
    userId: 'user-admin',
    role: 'admin',
    email: 'admin@example.com',
    employeeId: 'emp-1',
    token: 'token-admin-toggle',
  });

  const enableReq = {
    method: 'PATCH',
    query: { entity: 'employees', id: 'emp-1' },
    headers: { authorization: 'Bearer token-admin-toggle' },
    body: { data: { paidDriveTimeEnabled: true } },
  };
  const enableRes = createMockRes();

  await dataHandler(enableReq, enableRes);

  assert.equal(enableRes.statusCode, 200);
  let employee = await getEmployeeForBusiness('biz-eligibility', 'emp-1');
  assert.equal(employee.paidDriveTimeEnabled, true);

  const disableReq = {
    method: 'PATCH',
    query: { entity: 'employees', id: 'emp-1' },
    headers: { authorization: 'Bearer token-admin-toggle' },
    body: { data: { paidDriveTimeEnabled: false } },
  };
  const disableRes = createMockRes();

  await dataHandler(disableReq, disableRes);

  assert.equal(disableRes.statusCode, 200);
  employee = await getEmployeeForBusiness('biz-eligibility', 'emp-1');
  assert.equal(employee.paidDriveTimeEnabled, false);
});

test('crew member cannot change paid drive time eligibility through employee update endpoint', async (t) => {
  const store = installDdbMock(t);
  seedBusinessUser(store, {
    businessId: 'biz-deny',
    userId: 'user-crew',
    role: 'crew_member',
    email: 'crew@example.com',
  });

  await createEmployeeForBusiness({
    businessId: 'biz-deny',
    employee: {
      id: 'emp-crew',
      name: 'Crew Employee',
      email: 'crew@example.com',
      phone: '',
      role: 'crew_member',
      hourlyRate: 24,
      compensationType: 'hourly',
      labourType: 'field_producing',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      paidDriveTimeEnabled: false,
    },
  });

  await createBearerTokenForUser({
    businessId: 'biz-deny',
    userId: 'user-crew',
    role: 'crew_member',
    email: 'crew@example.com',
    employeeId: 'emp-crew',
    token: 'token-crew-deny',
  });

  const req = {
    method: 'PATCH',
    query: { entity: 'employees', id: 'emp-crew' },
    headers: { authorization: 'Bearer token-crew-deny' },
    body: { data: { paidDriveTimeEnabled: true } },
  };
  const res = createMockRes();

  await dataHandler(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.ok, false);
});

test('backend rejects drive time clock-in for ineligible employee', async (t) => {
  const store = installDdbMock(t);
  seedBusinessUser(store, {
    businessId: 'biz-clock',
    userId: 'user-crew',
    role: 'crew_member',
    email: 'crew@example.com',
  });

  await createEmployeeForBusiness({
    businessId: 'biz-clock',
    employee: {
      id: 'emp-clock',
      name: 'Clock Employee',
      email: 'crew@example.com',
      phone: '',
      role: 'crew_member',
      hourlyRate: 24,
      compensationType: 'hourly',
      labourType: 'field_producing',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      paidDriveTimeEnabled: false,
    },
  });

  await createBearerTokenForUser({
    businessId: 'biz-clock',
    userId: 'user-crew',
    role: 'crew_member',
    email: 'crew@example.com',
    employeeId: 'emp-clock',
    token: 'token-drive-deny',
  });

  const req = {
    method: 'POST',
    query: { action: 'clock-in' },
    headers: { authorization: 'Bearer token-drive-deny' },
    body: {
      employeeId: 'emp-clock',
      workType: 'drive_time',
      jobIds: [],
      requestId: 'req-1',
      idempotencyKey: 'idemp-1',
    },
  };
  const res = createMockRes();

  await clockingHandler(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'Drive time is not enabled for this employee.');
});

test('eligible employee can pass drive time validation for clock-in', async (t) => {
  const store = installDdbMock(t);
  seedBusinessUser(store, {
    businessId: 'biz-clock-allow',
    userId: 'user-crew-allow',
    role: 'crew_member',
    email: 'crewallow@example.com',
  });

  await createEmployeeForBusiness({
    businessId: 'biz-clock-allow',
    employee: {
      id: 'emp-clock-allow',
      name: 'Clock Employee Allow',
      email: 'crewallow@example.com',
      phone: '',
      role: 'crew_member',
      hourlyRate: 24,
      compensationType: 'hourly',
      labourType: 'field_producing',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      paidDriveTimeEnabled: true,
    },
  });

  await createBearerTokenForUser({
    businessId: 'biz-clock-allow',
    userId: 'user-crew-allow',
    role: 'crew_member',
    email: 'crewallow@example.com',
    employeeId: 'emp-clock-allow',
    token: 'token-drive-allow',
  });

  const req = {
    method: 'POST',
    query: { action: 'clock-in' },
    headers: { authorization: 'Bearer token-drive-allow' },
    body: {
      employeeId: 'emp-clock-allow',
      workType: 'drive_time',
      jobIds: [],
      requestId: 'req-allow',
      idempotencyKey: 'idemp-allow',
    },
  };
  const res = createMockRes();

  await clockingHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.timeEntry.workType, 'drive_time');
});

test('disabling eligibility does not alter historical drive time records', async (t) => {
  const store = installDdbMock(t);
  seedBusinessUser(store, {
    businessId: 'biz-history',
    userId: 'user-admin-history',
    role: 'admin',
    email: 'admin.history@example.com',
  });

  await createEmployeeForBusiness({
    businessId: 'biz-history',
    employee: {
      id: 'emp-history',
      name: 'History Employee',
      email: 'history@example.com',
      phone: '',
      role: 'crew_member',
      hourlyRate: 24,
      compensationType: 'hourly',
      labourType: 'field_producing',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      paidDriveTimeEnabled: true,
    },
  });

  store.set(
    mapKey('BUSINESS#biz-history', 'TIME#entry-history-1'),
    {
      PK: 'BUSINESS#biz-history',
      SK: 'TIME#entry-history-1',
      entityType: 'TIME_ENTRY',
      businessId: 'biz-history',
      entryId: 'entry-history-1',
      employeeId: 'emp-history',
      workType: 'drive_time',
      jobIds: [],
      clockIn: '2026-08-01T08:00:00.000Z',
      clockOut: '2026-08-01T09:00:00.000Z',
      breakMinutes: 0,
      notes: 'Historical drive time',
      status: 'clocked_out',
    }
  );

  const before = await listTimeEntriesForBusiness('biz-history');
  assert.equal(before.length, 1);
  assert.equal(before[0].workType, 'drive_time');

  await createBearerTokenForUser({
    businessId: 'biz-history',
    userId: 'user-admin-history',
    role: 'admin',
    email: 'admin.history@example.com',
    employeeId: 'emp-history',
    token: 'token-history-toggle',
  });

  const req = {
    method: 'PATCH',
    query: { entity: 'employees', id: 'emp-history' },
    headers: { authorization: 'Bearer token-history-toggle' },
    body: { data: { paidDriveTimeEnabled: false } },
  };
  const res = createMockRes();

  await dataHandler(req, res);
  assert.equal(res.statusCode, 200);

  const after = await listTimeEntriesForBusiness('biz-history');
  assert.equal(after.length, 1);
  assert.equal(after[0].workType, 'drive_time');
  assert.equal(after[0].status, 'clocked_out');
});

test('active drive time can clock out safely after eligibility is disabled', async (t) => {
  const store = installDdbMock(t);
  seedBusinessUser(store, {
    businessId: 'biz-active',
    userId: 'user-active',
    role: 'crew_member',
    email: 'active@example.com',
  });

  await createEmployeeForBusiness({
    businessId: 'biz-active',
    employee: {
      id: 'emp-active',
      name: 'Active Employee',
      email: 'active@example.com',
      phone: '',
      role: 'crew_member',
      hourlyRate: 24,
      compensationType: 'hourly',
      labourType: 'field_producing',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      paidDriveTimeEnabled: false,
    },
  });

  store.set(
    mapKey('BUSINESS#biz-active', 'TIME#entry-active-drive'),
    {
      PK: 'BUSINESS#biz-active',
      SK: 'TIME#entry-active-drive',
      entityType: 'TIME_ENTRY',
      businessId: 'biz-active',
      entryId: 'entry-active-drive',
      employeeId: 'emp-active',
      workType: 'drive_time',
      jobIds: [],
      clockIn: '2026-08-01T08:00:00.000Z',
      breakMinutes: 0,
      notes: '',
      status: 'clocked_in',
    }
  );

  store.set(
    mapKey('BUSINESS#biz-active#EMPLOYEE#emp-active', 'ACTIVE_SHIFT'),
    {
      PK: 'BUSINESS#biz-active#EMPLOYEE#emp-active',
      SK: 'ACTIVE_SHIFT',
      entityType: 'ACTIVE_SHIFT',
      businessId: 'biz-active',
      employeeId: 'emp-active',
      activeEntryId: 'entry-active-drive',
      status: 'active',
      startedAt: '2026-08-01T08:00:00.000Z',
      updatedAt: '2026-08-01T08:00:00.000Z',
    }
  );

  await createBearerTokenForUser({
    businessId: 'biz-active',
    userId: 'user-active',
    role: 'crew_member',
    email: 'active@example.com',
    employeeId: 'emp-active',
    token: 'token-active-clockout',
  });

  const req = {
    method: 'POST',
    query: { action: 'clock-out' },
    headers: { authorization: 'Bearer token-active-clockout' },
    body: {
      entryId: 'entry-active-drive',
      breakMinutes: 0,
      notes: 'Completed travel',
      requestId: 'req-clockout-active',
      idempotencyKey: 'idemp-clockout-active',
    },
  };
  const res = createMockRes();

  await clockingHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.timeEntry.workType, 'drive_time');
  assert.equal(res.body.timeEntry.status, 'clocked_out');
});

test('drive-time eligibility helper keeps non-drive work types allowed', () => {
  assert.equal(canRecordDriveTime('job', { paidDriveTimeEnabled: false }), true);
  assert.equal(canRecordDriveTime('non_billable', { paidDriveTimeEnabled: false }), true);
  assert.equal(canRecordDriveTime('drive_time', { paidDriveTimeEnabled: false }), false);
  assert.equal(canRecordDriveTime('drive_time', { paidDriveTimeEnabled: true }), true);
});
