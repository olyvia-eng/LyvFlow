# Storage Integrity Hardening

Phase D hardens the storage lifecycle so the server remains the source of truth for file metadata, completion, download, and deletion.

## Canonical flow

1. Authenticated `prepare-upload` request.
2. Server resolves the trusted business/session and validates the entity, category, filename, extension, MIME type, and size.
3. Server generates `fileId` and the S3 object key.
4. Server stores a pending file record in DynamoDB.
5. Server returns a short-lived presigned PUT URL plus the `fileId` and required headers.
6. Browser uploads the file directly to S3.
7. Browser calls `complete-upload` with `fileId` only.
8. Server loads the trusted pending record, re-authorizes the owning entity, and verifies the S3 object with `HeadObject`.
9. Server confirms `ContentLength` and `ContentType` before marking the file uploaded.
10. Later view/download/delete actions resolve the object key from DynamoDB by `fileId`.

## File record key pattern

Files continue to use the business-partitioned single-table layout:

- `PK = BUSINESS#<businessId>`
- `SK = FILE#<fileId>`

This supports direct lookup by business and file ID and business-scoped listing via `begins_with(SK, 'FILE#')`.

### Trusted file fields

Pending records store trusted metadata, including:

- `fileId`
- `businessId`
- `entityType`
- `entityId`
- `category`
- `originalFileName`
- `sanitizedFileName`
- `objectKey`
- `expectedContentType`
- `expectedFileSize`
- `uploadedByUserId`
- `uploadStatus = pending`
- `createdAt`
- `updatedAt`
- `expiresAt`
- `ttl`

Uploaded records keep the trusted `objectKey` and mark `uploadStatus = uploaded`.

## View / download

View and download requests accept `fileId` only. The server loads the trusted file metadata, requires `uploadStatus = uploaded`, validates business/entity ownership, and returns a short-lived signed URL.

## Delete

Delete requests accept `fileId` only. The server resolves the trusted `objectKey`, deletes the S3 object first, and then removes the DynamoDB metadata. Missing S3 objects are handled safely and reported only as integrity warnings.

## Legacy compatibility

- Legacy receipt read paths remain in place.
- Existing `photoAttachmentUrl` values still render.
- New uploads never write base64 file data into DynamoDB.
- New uploads do not use the legacy receipt POST path.
- Legacy write attempts should be handled with a controlled deprecated response.

## Cleanup

Use the business-scoped dry-run utility:

```bash
node scripts/storage-integrity-cleanup.mjs --business-id <businessId>
```

Apply destructive cleanup only with an explicit flag:

```bash
node scripts/storage-integrity-cleanup.mjs --business-id <businessId> --apply
```

The script reports:

- expired pending DynamoDB records
- pending records with missing S3 objects
- uploaded records with missing S3 objects
- orphan S3 objects without file metadata

TTL is used for pending records, but DynamoDB TTL deletion is asynchronous and must not be treated as immediate cleanup.

## Environment variables

Canonical bucket variable:

- `AWS_S3_BUCKET_NAME`

Also required by the existing storage helpers:

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY` when using long-lived credentials locally

## Rollback notes

If you need to roll back the phase, revert the storage API route, the shared upload helper, the documents caller, and the pending-file repository helpers together so the request/response shapes remain aligned.

## Manual test checklist

- Prepare upload returns `fileId`, `uploadUrl`, `requiredHeaders`, and `expiresAt`.
- Complete upload accepts `fileId` only.
- Download and delete accept `fileId` only.
- Clocking photo attachments still resolve by `photoAttachmentFileId`.
- Expense receipts still resolve by receipt file ID.
- Legacy receipt URLs still render.
- Dry-run cleanup reports orphan and pending integrity issues without deleting anything.