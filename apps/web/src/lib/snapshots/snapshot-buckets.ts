export type SnapshotSeriesBucket = 'day' | 'week' | 'month';

export function getBucketStart(date: Date, bucket: SnapshotSeriesBucket): Date {
  if (bucket === 'day') {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
  }

  if (bucket === 'week') {
    const day = date.getUTCDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const start = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
    start.setUTCDate(start.getUTCDate() + diff);
    return start;
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function getBucketKey(date: Date, bucket: SnapshotSeriesBucket): string {
  return getBucketStart(date, bucket).toISOString().slice(0, 10);
}
