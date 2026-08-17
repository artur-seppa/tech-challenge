import { afterEach, describe, expect, it } from 'vitest';
import { getPendingRetryConfig } from './pending-retry-config';

const originalThreshold = process.env.PENDING_RETRY_THRESHOLD_MINUTES;
const originalBatchSize = process.env.PENDING_RETRY_BATCH_SIZE;

afterEach(() => {
  process.env.PENDING_RETRY_THRESHOLD_MINUTES = originalThreshold;
  process.env.PENDING_RETRY_BATCH_SIZE = originalBatchSize;
});

describe('getPendingRetryConfig', () => {
  it('falls back to the local dev defaults when no env vars are set', () => {
    delete process.env.PENDING_RETRY_THRESHOLD_MINUTES;
    delete process.env.PENDING_RETRY_BATCH_SIZE;

    expect(getPendingRetryConfig()).toEqual({
      thresholdMinutes: 10,
      batchSize: 50,
    });
  });

  it('reads both values from the environment', () => {
    process.env.PENDING_RETRY_THRESHOLD_MINUTES = '15';
    process.env.PENDING_RETRY_BATCH_SIZE = '25';

    expect(getPendingRetryConfig()).toEqual({
      thresholdMinutes: 15,
      batchSize: 25,
    });
  });
});
