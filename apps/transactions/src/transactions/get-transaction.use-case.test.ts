import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../shared/errors/not-found.error';
import { GetTransactionUseCase } from './get-transaction.use-case';
import type { TransactionRecord, TransactionRepository } from './transaction.repository';

function makeRepositoryMock(record: TransactionRecord | null): TransactionRepository {
  return {
    createIdempotent: vi.fn(),
    findByExternalId: vi.fn().mockResolvedValue(record),
    findMany: vi.fn(),
    updateStatusByExternalId: vi.fn(),
    claimStalePending: vi.fn(),
  };
}

const record: TransactionRecord = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  accountExternalIdDebit: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
  accountExternalIdCredit: '3fa85f64-5717-4562-b3fc-2c963f66afa8',
  transferTypeId: 1,
  transferTypeName: 'Pagamento',
  value: 120,
  status: 'pending',
  createdAt: new Date('2026-08-14T10:00:00.000Z'),
};

describe('GetTransactionUseCase', () => {
  it('returns the transaction when it exists', async () => {
    const repository = makeRepositoryMock(record);
    const useCase = new GetTransactionUseCase(repository);

    const result = await useCase.execute(record.id);

    expect(repository.findByExternalId).toHaveBeenCalledWith(record.id);
    expect(result).toBe(record);
  });

  it('throws NotFoundError when the transaction does not exist', async () => {
    const repository = makeRepositoryMock(null);
    const useCase = new GetTransactionUseCase(repository);

    await expect(useCase.execute('missing-id')).rejects.toThrow(NotFoundError);
  });
});
