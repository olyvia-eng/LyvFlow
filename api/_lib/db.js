import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { requireEnv } from './env.js';

const region = requireEnv('AWS_REGION');

const client = new DynamoDBClient({ region });

export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export const tableName = requireEnv('DDB_TABLE_NAME');
