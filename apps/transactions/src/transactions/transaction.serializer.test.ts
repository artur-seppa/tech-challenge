import { describe, expect, it } from 'vitest';
import type { TransactionRecord } from './transaction.repository';
import { serializeTransaction } from './transaction.serializer';

const record: TransactionRecord = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  accountExternalIdDebit: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
  accountExternalIdCredit: '3fa85f64-5717-4562-b3fc-2c963f66afa8',
  transferTypeId: 1,
  transferTypeName: 'Pagamento',
  value: 120.5,
  status: 'approved',
  createdAt: new Date('2026-08-14T10:00:00.000Z'),
};

describe('serializeTransaction', () => {
  it('maps a transaction record to the API contract shape', () => {
    expect(serializeTransaction(record)).toEqual({
      transactionExternalId: record.id,
      transactionType: { name: 'Pagamento' },
      transactionStatus: { name: 'approved' },
      value: 120.5,
      createdAt: record.createdAt.toISOString(),
    });
  });
});
