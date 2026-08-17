import { describe, expect, it, vi } from 'vitest';
import type { TransactionRecord, TransactionRepository } from './transaction.repository';
import { UpdateTransactionStatusUseCase } from './update-transaction-status.use-case';

function makeRepositoryMock(record: TransactionRecord | null): TransactionRepository {
  return {
    createIdempotent: vi.fn(),
    findByExternalId: vi.fn(),
    findMany: vi.fn(),
    updateStatusByExternalId: vi.fn().mockResolvedValue(record),
    claimStalePending: vi.fn(),
  };
}

const record: TransactionRecord = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  accountExternalIdDebit: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
  accountExternalIdCredit: '3fa85f64-5717-4562-b3fc-2c963f66afa8',
  transferTypeId: 1,
  transferTypeName: 'Pagamento',
  value: 2500,
  status: 'rejected',
  createdAt: new Date('2026-08-14T10:00:00.000Z'),
};

describe('UpdateTransactionStatusUseCase', () => {
  it('updates the transaction status by external id', async () => {
    const repository = makeRepositoryMock(record);
    const useCase = new UpdateTransactionStatusUseCase(repository);

    await useCase.execute({ transactionExternalId: record.id, status: 'rejected' });

    expect(repository.updateStatusByExternalId).toHaveBeenCalledWith(record.id, 'rejected');
  });

  it('does not throw when the transaction does not exist', async () => {
    const repository = makeRepositoryMock(null);
    const useCase = new UpdateTransactionStatusUseCase(repository);

    await expect(
      useCase.execute({ transactionExternalId: 'missing-id', status: 'approved' }),
    ).resolves.toBeUndefined();
  });
});
