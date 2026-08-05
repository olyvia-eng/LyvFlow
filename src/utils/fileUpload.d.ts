export interface ValidateUploadPayloadInput {
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface ValidateUploadPayloadSuccess {
  ok: true;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ValidateUploadPayloadFailure {
  ok: false;
  error: string;
}

export type ValidateUploadPayloadResult = ValidateUploadPayloadSuccess | ValidateUploadPayloadFailure;

export function validateUploadPayload(input: ValidateUploadPayloadInput): ValidateUploadPayloadResult;

export interface UploadFileToStorageInput {
  file: File;
  entityType: string;
  entityId: string;
  category: string;
}

export interface UploadFileToStorageResult {
  fileId: string;
  key: string;
}

export function uploadFileToStorage(input: UploadFileToStorageInput): Promise<UploadFileToStorageResult>;

export interface ResolveAttachmentUrlInput {
  fileId?: string;
  legacyUrl?: string;
}

export function resolveAttachmentUrl(input: ResolveAttachmentUrlInput): Promise<string>;
