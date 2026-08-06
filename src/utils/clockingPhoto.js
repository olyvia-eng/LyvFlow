export function buildClockOutPayload({ entryId, breakMinutes = 0, notes = '', photoAttachmentFileId }) {
  return {
    entryId,
    breakMinutes,
    notes,
    ...(typeof photoAttachmentFileId === 'string' && photoAttachmentFileId.trim().length > 0
      ? { photoAttachmentFileId: photoAttachmentFileId.trim() }
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
