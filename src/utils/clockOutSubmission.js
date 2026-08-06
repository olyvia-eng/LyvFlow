function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

export function createClockOutRequestMeta(entryId) {
  const safeEntryId = typeof entryId === 'string' ? entryId.trim() : '';
  const requestId = `${safeEntryId}:${Date.now()}:${randomSuffix()}`;
  return {
    requestId,
    idempotencyKey: `${safeEntryId}:${requestId}`,
  };
}

export function beginClockOutSubmission(inFlightEntryIds, entryId) {
  const current = Array.isArray(inFlightEntryIds) ? inFlightEntryIds : [];
  if (current.includes(entryId)) {
    return { allowed: false, nextInFlightEntryIds: current };
  }
  return { allowed: true, nextInFlightEntryIds: [...current, entryId] };
}

export function endClockOutSubmission(inFlightEntryIds, entryId) {
  const current = Array.isArray(inFlightEntryIds) ? inFlightEntryIds : [];
  return current.filter((id) => id !== entryId);
}
