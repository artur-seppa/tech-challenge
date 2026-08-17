import { describe, expect, it, vi } from 'vitest';
import type { KafkaPublisherService } from '../shared/messaging/kafka-publisher.service';
import { CreateTransactionUseCase } from './create-transaction.use-case';
import type {
  CreateTransactionResult,
  TransactionRecord,
  TransactionRepository,
} from './transaction.repository';

function makeRepositoryMock(result: CreateTransactionResult): TransactionRepository {
  return {
    createIdempotent: vi.fn().mockResolvedValue(result),
    findByExternalId: vi.fn(),
    findMany: vi.fn(),
    updateStatusByExternalId: vi.fn(),
    claimStalePending: vi.fn(),
  };
}

function makePublisherMock(): KafkaPublisherService {
  return { publish: vi.fn() } as unknown as KafkaPublisherService;
}

const input = {
  accountExternalIdDebit: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
  accountExternalIdCredit: '3fa85f64-5717-4562-b3fc-2c963f66afa8',
  transferTypeId: 1,
  value: 120,
};

const record: TransactionRecord = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  ...input,
  transferTypeName: 'Pagamento',
  status: 'pending',
  createdAt: new Date('2026-08-14T10:00:00.000Z'),
};

describe('CreateTransactionUseCase', () => {
  it('creates the transaction as pending', async () => {
    const repository = makeRepositoryMock({ transaction: record, wasCreated: true });
    const publisher = makePublisherMock();
    const useCase = new CreateTransactionUseCase(repository, publisher);

    const result = await useCase.execute(input);

    expect(repository.createIdempotent).toHaveBeenCalledWith(input);
    expect(result).toBe(record);
  });

  it('publishes a transaction.created event with the created data', async () => {
    const repository = makeRepositoryMock({ transaction: record, wasCreated: true });
    const publisher = makePublisherMock();
    const useCase = new CreateTransactionUseCase(repository, publisher);

    await useCase.execute(input);

    expect(publisher.publish).toHaveBeenCalledWith('transaction.created', {
      transactionExternalId: record.id,
      accountExternalIdDebit: record.accountExternalIdDebit,
      accountExternalIdCredit: record.accountExternalIdCredit,
      transferTypeId: record.transferTypeId,
      value: record.value,
      createdAt: record.createdAt.toISOString(),
    });
  });

  it('returns the existing transaction without publishing again on an idempotent replay', async () => {
    const repository = makeRepositoryMock({ transaction: record, wasCreated: false });
    const publisher = makePublisherMock();
    const useCase = new CreateTransactionUseCase(repository, publisher);

    const result = await useCase.execute({ ...input, idempotencyKey: 'retry-key' });

    expect(result).toBe(record);
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});
