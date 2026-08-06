import test from 'node:test';
import assert from 'node:assert/strict';

import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../api/_lib/db.js';
import { listExpensesForBusiness, getExpenseForBusiness } from '../api/_lib/authRepo.js';

test('expense serialization includes receiptFileId so receipt remains visible after refresh', async () => {
  const originalSend = ddb.send.bind(ddb);

  ddb.send = async (command) => {
    if (command instanceof QueryCommand) {
      return {
        Items: [
          {
            PK: 'BUSINESS#biz-1',
            SK: 'EXPENSE#expense-1',
            entityType: 'EXPENSE',
            businessId: 'biz-1',
            expenseId: 'expense-1',
            vendor: 'Acme',
            description: 'Materials',
            category: 'materials',
            expenseDate: '2026-01-01',
            amount: 100,
            status: 'pending',
            notes: '',
            receiptFileId: 'file-1',
            receiptUrl: undefined,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };
    }

    if (command instanceof GetCommand) {
      return {
        Item: {
          PK: 'BUSINESS#biz-1',
          SK: 'EXPENSE#expense-1',
          entityType: 'EXPENSE',
          businessId: 'biz-1',
          expenseId: 'expense-1',
          vendor: 'Acme',
          description: 'Materials',
          category: 'materials',
          expenseDate: '2026-01-01',
          amount: 100,
          status: 'pending',
          notes: '',
          receiptFileId: 'file-1',
          receiptUrl: undefined,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      };
    }

    return { Item: null, Items: [] };
  };

  try {
    const list = await listExpensesForBusiness('biz-1');
    const single = await getExpenseForBusiness('biz-1', 'expense-1');

    assert.equal(list.length, 1);
    assert.equal(list[0].receiptFileId, 'file-1');
    assert.equal(single?.receiptFileId, 'file-1');
  } finally {
    ddb.send = originalSend;
  }
});
