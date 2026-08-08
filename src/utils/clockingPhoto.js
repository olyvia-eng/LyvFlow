export function buildClockOutPayload({
  entryId,
  breakMinutes = 0,
  notes = '',
  photoAttachmentFileId,
  photoAttachmentFileIds,
}) {
  const normalizedPhotoAttachmentFileIds = Array.isArray(photoAttachmentFileIds)
    ? [...new Set(photoAttachmentFileIds.filter((value) => typeof value === 'string').map((value) => value.trim()).filter(Boolean))]
    : [];
  const normalizedPhotoAttachmentFileId = typeof photoAttachmentFileId === 'string' && photoAttachmentFileId.trim()
    ? photoAttachmentFileId.trim()
    : undefined;

  if (normalizedPhotoAttachmentFileIds.length === 0 && normalizedPhotoAttachmentFileId) {
    normalizedPhotoAttachmentFileIds.push(normalizedPhotoAttachmentFileId);
  }

  return {
    entryId,
    breakMinutes,
    notes,
    ...(normalizedPhotoAttachmentFileIds.length > 0
      ? {
          photoAttachmentFileIds: normalizedPhotoAttachmentFileIds,
          photoAttachmentFileId: normalizedPhotoAttachmentFileIds[0],
        }
      : {}),
  };
}

export function clearPhotoAttachmentState() {
  return { fileId: '', fileName: '' };
}

export function applyUploadedPhotoAttachment(state, { fileId, fileName }) {
  return {
    ...state,
    fileId: typeof fileId === 'string' ? fileId : '',
    fileName: typeof fileName === 'string' ? fileName : '',
  };
}
