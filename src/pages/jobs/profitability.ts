export function classifyTrackedHoursByWorkType(workType: string | undefined, hours: number) {
  if (workType === 'job') {
    return { billableHours: hours, nonBillableHours: 0 };
  }
  return { billableHours: 0, nonBillableHours: hours };
}
