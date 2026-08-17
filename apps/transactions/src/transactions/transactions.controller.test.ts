import { describe, expect, it, vi } from 'vitest';
import type { CreateTransactionUseCase } from './create-transaction.use-case';
import type { GetTransactionUseCase } from './get-transaction.use-case';
import type { ListTransactionsUseCase } from './list-transactions.use-case';
import type { TransactionRecord } from './transaction.repository';
import { TransactionsController } from './transactions.controller';

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

function makeController(overrides: {
  create?: TransactionRecord;
  get?: TransactionRecord;
  list?: {
    data: TransactionRecord[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  };
}) {
  const createTransaction = {
    execute: vi.fn().mockResolvedValue(overrides.create ?? record),
  } as unknown as CreateTransactionUseCase;
  const getTransaction = {
    execute: vi.fn().mockResolvedValue(overrides.get ?? record),
  } as unknown as GetTransactionUseCase;
  const listTransactions = {
    execute: vi.fn().mockResolvedValue(
      overrides.list ?? {
        data: [record],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
    ),
  } as unknown as ListTransactionsUseCase;

  return {
    controller: new TransactionsController(createTransaction, getTransaction, listTransactions),
    createTransaction,
    getTransaction,
    listTransactions,
  };
}

describe('TransactionsController', () => {
  it('creates a transaction and returns it serialized', async () => {
    const { controller, createTransaction } = makeController({});
    const dto = {
      accountExternalIdDebit: record.accountExternalIdDebit,
      accountExternalIdCredit: record.accountExternalIdCredit,
      transferTypeId: record.transferTypeId,
      value: record.value,
    };

    const result = await controller.create(dto);

    expect(createTransaction.execute).toHaveBeenCalledWith(dto);
    expect(result).toEqual({
      transactionExternalId: record.id,
      transactionType: { name: 'Pagamento' },
      transactionStatus: { name: 'pending' },
      value: 120,
      createdAt: record.createdAt.toISOString(),
    });
  });

  it('forwards the Idempotency-Key header to the use case', async () => {
    const { controller, createTransaction } = makeController({});
    const dto = {
      accountExternalIdDebit: record.accountExternalIdDebit,
      accountExternalIdCredit: record.accountExternalIdCredit,
      transferTypeId: record.transferTypeId,
      value: record.value,
    };

    await controller.create(dto, 'client-generated-key');

    expect(createTransaction.execute).toHaveBeenCalledWith({
      ...dto,
      idempotencyKey: 'client-generated-key',
    });
  });

  it('returns a transaction by external id serialized', async () => {
    const { controller, getTransaction } = makeController({});

    const result = await controller.getById(record.id);

    expect(getTransaction.execute).toHaveBeenCalledWith(record.id);
    expect(result.transactionExternalId).toBe(record.id);
  });

  it('lists transactions serialized, keeping pagination meta', async () => {
    const { controller, listTransactions } = makeController({});

    const result = await controller.list({ page: 1, pageSize: 20 });

    expect(listTransactions.execute).toHaveBeenCalledWith({
      filter: { status: undefined, transferTypeId: undefined, from: undefined, to: undefined },
      page: 1,
      pageSize: 20,
    });
    expect(result.meta).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
    expect(result.data).toEqual([
      {
        transactionExternalId: record.id,
        transactionType: { name: 'Pagamento' },
        transactionStatus: { name: 'pending' },
        value: 120,
        createdAt: record.createdAt.toISOString(),
      },
    ]);
  });

  it('converts from/to query strings to Date filters', async () => {
    const { controller, listTransactions } = makeController({});

    await controller.list({
      status: 'approved',
      transferTypeId: 2,
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-14T23:59:59.999Z',
      page: 2,
      pageSize: 10,
    });

    expect(listTransactions.execute).toHaveBeenCalledWith({
      filter: {
        status: 'approved',
        transferTypeId: 2,
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-14T23:59:59.999Z'),
      },
      page: 2,
      pageSize: 10,
    });
  });
});
