export interface PendingRetryConfig {
  thresholdMinutes: number;
  batchSize: number;
}

export function getPendingRetryConfig(): PendingRetryConfig {
  return {
    thresholdMinutes: Number(process.env.PENDING_RETRY_THRESHOLD_MINUTES ?? '10'),
    batchSize: Number(process.env.PENDING_RETRY_BATCH_SIZE ?? '50'),
  };
}
