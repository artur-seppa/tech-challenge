import { describe, expect, it, vi } from 'vitest';
import type { KafkaPublisherService } from '../shared/messaging/kafka-publisher.service';
import { RetryStaleTransactionsUseCase } from './retry-stale-transactions.use-case';
import type { StalePendingTransaction, TransactionRepository } from './transaction.repository';

function makeRepositoryMock(stale: StalePendingTransaction[]): TransactionRepository {
  return {
    createIdempotent: vi.fn(),
    findByExternalId: vi.fn(),
    findMany: vi.fn(),
    updateStatusByExternalId: vi.fn(),
    claimStalePending: vi.fn().mockResolvedValue(stale),
  };
}

function makePublisherMock(): KafkaPublisherService {
  return { publish: vi.fn() } as unknown as KafkaPublisherService;
}

const stale: StalePendingTransaction = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  accountExternalIdDebit: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
  accountExternalIdCredit: '3fa85f64-5717-4562-b3fc-2c963f66afa8',
  transferTypeId: 1,
  value: 120,
  createdAt: new Date('2026-08-14T10:00:00.000Z'),
};

const olderThan = new Date('2026-08-17T12:00:00.000Z');

describe('RetryStaleTransactionsUseCase', () => {
  it('claims stale pending transactions with the given cutoff and limit', async () => {
    const repository = makeRepositoryMock([]);
    const publisher = makePublisherMock();
    const useCase = new RetryStaleTransactionsUseCase(repository, publisher);

    await useCase.execute(olderThan, 50);

    expect(repository.claimStalePending).toHaveBeenCalledWith(olderThan, 50);
  });

  it('re-emits transaction.created for each claimed transaction', async () => {
    const repository = makeRepositoryMock([stale]);
    const publisher = makePublisherMock();
    const useCase = new RetryStaleTransactionsUseCase(repository, publisher);

    await useCase.execute(olderThan, 50);

    expect(publisher.publish).toHaveBeenCalledWith('transaction.created', {
      transactionExternalId: stale.id,
      accountExternalIdDebit: stale.accountExternalIdDebit,
      accountExternalIdCredit: stale.accountExternalIdCredit,
      transferTypeId: stale.transferTypeId,
      value: stale.value,
      createdAt: stale.createdAt.toISOString(),
    });
  });

  it('returns the number of transactions retried', async () => {
    const repository = makeRepositoryMock([stale, { ...stale, id: 'other-id' }]);
    const publisher = makePublisherMock();
    const useCase = new RetryStaleTransactionsUseCase(repository, publisher);

    const result = await useCase.execute(olderThan, 50);

    expect(result).toBe(2);
  });

  it('does nothing when there are no stale pending transactions', async () => {
    const repository = makeRepositoryMock([]);
    const publisher = makePublisherMock();
    const useCase = new RetryStaleTransactionsUseCase(repository, publisher);

    const result = await useCase.execute(olderThan, 50);

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });
});
