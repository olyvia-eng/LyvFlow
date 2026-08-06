import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { listFilesForBusiness, deleteFileForBusiness } from '../api/_lib/authRepo.js';
import { headStoredFile, removeStoredFile } from '../api/_lib/storage.js';
import { requireEnv } from '../api/_lib/env.js';

function parseArgs(argv) {
  const args = { apply: false, json: false, businessId: '' };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--apply') args.apply = true;
    else if (value === '--json') args.json = true;
    else if (value === '--dry-run') args.apply = false;
    else if (value === '--business-id') {
      args.businessId = argv[index + 1] ?? '';
      index += 1;
    }
  }

  return args;
}

function nowIso() {
  return new Date().toISOString();
}

function getS3Client() {
  const region = requireEnv('AWS_REGION');
  const endpoint = process.env.S3_ENDPOINT;
  const forcePathStyle = Boolean(process.env.S3_FORCE_PATH_STYLE);

  return new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
      : undefined,
  });
}

async function listBusinessObjects(businessId) {
  const client = getS3Client();
  const bucket = requireEnv('AWS_S3_BUCKET_NAME');
  const keys = [];
  let continuationToken;

  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: `${businessId}/`,
      ContinuationToken: continuationToken,
    }));

    for (const object of response.Contents ?? []) {
      if (typeof object.Key === 'string') {
        keys.push(object.Key);
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

async function main() {
  const { apply, json, businessId } = parseArgs(process.argv);
  if (!businessId) {
    console.error('Usage: node scripts/storage-integrity-cleanup.mjs --business-id <businessId> [--apply] [--json]');
    process.exitCode = 1;
    return;
  }

  const files = await listFilesForBusiness(businessId);
  const objectKeys = await listBusinessObjects(businessId);
  const fileKeySet = new Set(files.map((file) => file.objectKey ?? file.key).filter(Boolean));
  const now = Date.now();
  const findings = [];

  for (const file of files) {
    const storageKey = file.objectKey ?? file.key;
    const isPending = file.uploadStatus === 'pending';
    const isUploaded = file.uploadStatus === 'uploaded';
    const isExpiredPending = isPending && typeof file.expiresAt === 'string' && new Date(file.expiresAt).getTime() <= now;

    if (isExpiredPending) {
      findings.push({ kind: 'expired-pending', fileId: file.id, storageKey, expiresAt: file.expiresAt });
    }

    if (storageKey) {
      const head = await headStoredFile({ businessId, key: storageKey });
      if (!head.ok && head.status === 404 && (isPending || isUploaded)) {
        findings.push({ kind: isPending ? 'pending-missing-object' : 'uploaded-missing-object', fileId: file.id, storageKey });
      }
    }
  }

  for (const objectKey of objectKeys) {
    if (!fileKeySet.has(objectKey)) {
      findings.push({ kind: 'orphan-s3-object', storageKey: objectKey });
    }
  }

  if (json) {
    console.log(JSON.stringify({ businessId, apply, generatedAt: nowIso(), findings }, null, 2));
  } else {
    console.log(`Storage integrity cleanup report for business ${businessId}`);
    console.log(`Mode: ${apply ? 'apply' : 'dry-run'}`);
    console.log(`Findings: ${findings.length}`);
    for (const finding of findings) {
      console.log(`- ${finding.kind} ${finding.fileId ? `(file ${finding.fileId})` : ''} ${finding.storageKey ? finding.storageKey : ''}`.trim());
    }
  }

  if (!apply || findings.length === 0) {
    return;
  }

  for (const finding of findings) {
    if (finding.kind === 'orphan-s3-object') {
      await removeStoredFile({ businessId, key: finding.storageKey });
      continue;
    }

    if (finding.fileId) {
      const file = files.find((item) => item.id === finding.fileId);
      if (file?.key || file?.objectKey) {
        await removeStoredFile({ businessId, key: file.objectKey ?? file.key });
      }
      await deleteFileForBusiness(businessId, finding.fileId);
    }
  }

  console.log('Applied cleanup actions successfully.');
}

await main();