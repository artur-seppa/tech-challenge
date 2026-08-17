import { describe, expect, it, vi } from 'vitest';
import { TransactionStatusUpdatedConsumer } from './transaction-status-updated.consumer';
import type { UpdateTransactionStatusUseCase } from './update-transaction-status.use-case';

function makeUseCaseMock(): UpdateTransactionStatusUseCase {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
  } as unknown as UpdateTransactionStatusUseCase;
}

describe('TransactionStatusUpdatedConsumer', () => {
  it('updates the transaction status for a valid payload', async () => {
    const updateStatus = makeUseCaseMock();
    const consumer = new TransactionStatusUpdatedConsumer(updateStatus);

    await consumer.handle({
      transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      status: 'approved',
    });

    expect(updateStatus.execute).toHaveBeenCalledWith({
      transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      status: 'approved',
    });
  });

  it('ignores a malformed payload instead of throwing', async () => {
    const updateStatus = makeUseCaseMock();
    const consumer = new TransactionStatusUpdatedConsumer(updateStatus);

    await expect(consumer.handle({ nope: true })).resolves.toBeUndefined();
    expect(updateStatus.execute).not.toHaveBeenCalled();
  });
});
