import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PendingTransactionsRetryJob } from './pending-transactions-retry.job';
import type { RetryStaleTransactionsUseCase } from './retry-stale-transactions.use-case';

const originalThreshold = process.env.PENDING_RETRY_THRESHOLD_MINUTES;
const originalBatchSize = process.env.PENDING_RETRY_BATCH_SIZE;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-17T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  process.env.PENDING_RETRY_THRESHOLD_MINUTES = originalThreshold;
  process.env.PENDING_RETRY_BATCH_SIZE = originalBatchSize;
});

function makeUseCaseMock(): RetryStaleTransactionsUseCase {
  return { execute: vi.fn().mockResolvedValue(0) } as unknown as RetryStaleTransactionsUseCase;
}

describe('PendingTransactionsRetryJob', () => {
  it('runs the use case with a cutoff thresholdMinutes in the past and the configured batch size', async () => {
    process.env.PENDING_RETRY_THRESHOLD_MINUTES = '10';
    process.env.PENDING_RETRY_BATCH_SIZE = '50';
    const useCase = makeUseCaseMock();
    const job = new PendingTransactionsRetryJob(useCase);

    await job.run();

    expect(useCase.execute).toHaveBeenCalledWith(new Date('2026-08-17T11:50:00.000Z'), 50);
  });

  it('reads the threshold and batch size from the environment on every run', async () => {
    process.env.PENDING_RETRY_THRESHOLD_MINUTES = '30';
    process.env.PENDING_RETRY_BATCH_SIZE = '10';
    const useCase = makeUseCaseMock();
    const job = new PendingTransactionsRetryJob(useCase);

    await job.run();

    expect(useCase.execute).toHaveBeenCalledWith(new Date('2026-08-17T11:30:00.000Z'), 10);
  });
});
