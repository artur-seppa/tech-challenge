import { describe, expect, it, vi } from 'vitest';
import { ListTransactionsUseCase } from './list-transactions.use-case';
import type { TransactionRecord, TransactionRepository } from './transaction.repository';

function makeRepositoryMock(result: {
  data: TransactionRecord[];
  total: number;
}): TransactionRepository {
  return {
    createIdempotent: vi.fn(),
    findByExternalId: vi.fn(),
    findMany: vi.fn().mockResolvedValue(result),
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

describe('ListTransactionsUseCase', () => {
  it('returns a paginated result built from the repository data', async () => {
    const repository = makeRepositoryMock({ data: [record], total: 1 });
    const useCase = new ListTransactionsUseCase(repository);

    const result = await useCase.execute({ filter: {}, page: 1, pageSize: 20 });

    expect(repository.findMany).toHaveBeenCalledWith({ filter: {}, page: 1, pageSize: 20 });
    expect(result).toEqual({
      data: [record],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
  });

  it('forwards status, transferTypeId and date range filters to the repository', async () => {
    const repository = makeRepositoryMock({ data: [], total: 0 });
    const useCase = new ListTransactionsUseCase(repository);
    const from = new Date('2026-08-01T00:00:00.000Z');
    const to = new Date('2026-08-14T23:59:59.999Z');

    await useCase.execute({
      filter: { status: 'approved', transferTypeId: 2, from, to },
      page: 2,
      pageSize: 10,
    });

    expect(repository.findMany).toHaveBeenCalledWith({
      filter: { status: 'approved', transferTypeId: 2, from, to },
      page: 2,
      pageSize: 10,
    });
  });
});
