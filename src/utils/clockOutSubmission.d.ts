export function createClockOutRequestMeta(entryId: string): {
  requestId: string;
  idempotencyKey: string;
};

export function beginClockOutSubmission(
  inFlightEntryIds: string[],
  entryId: string
): {
  allowed: boolean;
  nextInFlightEntryIds: string[];
};

export function endClockOutSubmission(
  inFlightEntryIds: string[],
  entryId: string
): string[];
