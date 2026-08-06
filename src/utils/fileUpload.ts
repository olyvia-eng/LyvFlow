const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENT_MIME_TYPES = new Set([
	'application/pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'text/csv',
]);

const IMAGE_LIMIT_BYTES = 25 * 1024 * 1024;
const PDF_LIMIT_BYTES = 25 * 1024 * 1024;
const OFFICE_LIMIT_BYTES = 15 * 1024 * 1024;
const CSV_LIMIT_BYTES = 5 * 1024 * 1024;

type UploadValidationSuccess = {
	ok: true;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
};

type UploadValidationFailure = {
	ok: false;
	error: string;
};

type UploadValidationResult = UploadValidationSuccess | UploadValidationFailure;

type ParsedStorageApiResponse = {
	ok?: boolean;
	error?: string;
	uploadUrl?: string;
	plan?: {
		fileId: string;
		key: string;
		fileName: string;
		mimeType: string;
		sizeBytes: number;
	};
	fileId?: string;
	key?: string;
	downloadUrl?: string;
};

function normalizeMimeType(mimeType?: string) {
	if (typeof mimeType !== 'string') return 'application/octet-stream';
	return mimeType.trim().toLowerCase() || 'application/octet-stream';
}

function getLimitForMimeType(mimeType: string) {
	const normalizedMime = normalizeMimeType(mimeType);
	if (IMAGE_MIME_TYPES.has(normalizedMime)) return IMAGE_LIMIT_BYTES;
	if (normalizedMime === 'application/pdf') return PDF_LIMIT_BYTES;
	if (normalizedMime === 'text/csv') return CSV_LIMIT_BYTES;
	if (DOCUMENT_MIME_TYPES.has(normalizedMime)) return OFFICE_LIMIT_BYTES;
	return IMAGE_LIMIT_BYTES;
}

export function validateUploadPayload({
	fileName,
	mimeType,
	sizeBytes,
}: {
	fileName?: string;
	mimeType?: string;
	sizeBytes?: number;
}): UploadValidationResult {
	const normalizedMime = normalizeMimeType(mimeType);
	const allowedMimes = new Set([...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES]);
	allowedMimes.add('application/pdf');
	if (!allowedMimes.has(normalizedMime)) {
		return { ok: false, error: 'Unsupported file type.' };
	}

	const safeSize = Number(sizeBytes);
	if (!Number.isFinite(safeSize) || safeSize <= 0) {
		return { ok: false, error: 'Invalid file size.' };
	}

	const limit = getLimitForMimeType(normalizedMime);
	if (safeSize > limit) {
		const limitLabel = limit >= 1024 * 1024 ? `${limit / (1024 * 1024)} MB` : `${limit} bytes`;
		return { ok: false, error: `File exceeds ${limitLabel} limit.` };
	}

	return {
		ok: true,
		fileName: fileName?.trim() || 'file',
		mimeType: normalizedMime,
		sizeBytes: safeSize,
	};
}

export async function parseStorageApiResponse(response: Response, fallbackErrorMessage?: string): Promise<ParsedStorageApiResponse> {
	const contentType = (response.headers.get('content-type') || '').toLowerCase();
	const isJson = contentType.includes('application/json');

	if (isJson) {
		try {
			return await response.json() as ParsedStorageApiResponse;
		} catch {
			return {
				ok: false,
				error: fallbackErrorMessage || 'Storage service returned invalid JSON.',
			};
		}
	}

	let bodyText = '';
	try {
		bodyText = (await response.text()).trim();
	} catch {
		bodyText = '';
	}

	return {
		ok: false,
		error: bodyText || fallbackErrorMessage || 'Storage service returned a non-JSON response.',
	};
}

export async function uploadFileToStorage({
	file,
	entityType,
	entityId,
	category,
}: {
	file: File;
	entityType: string;
	entityId: string;
	category: string;
}): Promise<{ fileId: string; key: string }> {
	const validation = validateUploadPayload({
		fileName: file?.name,
		mimeType: file?.type,
		sizeBytes: file?.size,
	});

	if (!validation.ok) {
		throw new Error(validation.error);
	}

	const prepareResponse = await fetch('/api/storage', {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			action: 'prepare-upload',
			fileName: file.name,
			mimeType: validation.mimeType,
			sizeBytes: validation.sizeBytes,
			entityType,
			entityId,
			category,
		}),
	});

	const preparePayload = await parseStorageApiResponse(prepareResponse, 'Upload could not be prepared.');
	if (!prepareResponse.ok || !preparePayload?.ok || !preparePayload.uploadUrl || !preparePayload.plan) {
		throw new Error(preparePayload?.error || 'Upload could not be prepared.');
	}

	const uploadResponse = await fetch(preparePayload.uploadUrl, {
		method: 'PUT',
		headers: { 'Content-Type': validation.mimeType },
		body: file,
	});

	if (!uploadResponse.ok) {
		throw new Error('The direct S3 upload failed.');
	}

	const completeResponse = await fetch('/api/storage', {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			action: 'complete-upload',
			fileId: preparePayload.plan.fileId,
			key: preparePayload.plan.key,
			fileName: preparePayload.plan.fileName,
			mimeType: preparePayload.plan.mimeType,
			sizeBytes: preparePayload.plan.sizeBytes,
			entityType,
			entityId,
			category,
		}),
	});

	const completePayload = await parseStorageApiResponse(completeResponse, 'The upload could not be finalized.');
	if (!completeResponse.ok || !completePayload?.ok) {
		throw new Error(completePayload?.error || 'The upload could not be finalized.');
	}

	if (typeof completePayload.fileId !== 'string' || typeof completePayload.key !== 'string') {
		throw new Error('The upload response was missing file metadata.');
	}

	return {
		fileId: completePayload.fileId,
		key: completePayload.key,
	};
}

export async function resolveAttachmentUrl({
	fileId,
	legacyUrl,
}: {
	fileId?: string;
	legacyUrl?: string;
}) {
	if (!fileId) {
		return legacyUrl || '';
	}

	try {
		const response = await fetch('/api/storage', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'prepare-download', fileId }),
		});

		const payload = await parseStorageApiResponse(response, 'Download could not be prepared.');
		if (!response.ok || !payload?.ok || typeof payload.downloadUrl !== 'string') {
			return legacyUrl || '';
		}

		return payload.downloadUrl;
	} catch {
		return legacyUrl || '';
	}
}
