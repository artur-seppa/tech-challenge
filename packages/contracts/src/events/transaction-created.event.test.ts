import { describe, expect, it } from 'vitest';
import { transactionCreatedEventSchema } from './transaction-created.event';

const validPayload = {
  transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  accountExternalIdDebit: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
  accountExternalIdCredit: '3fa85f64-5717-4562-b3fc-2c963f66afa8',
  transferTypeId: 1,
  value: 120,
  createdAt: '2026-08-13T10:00:00.000Z',
};

describe('transactionCreatedEventSchema', () => {
  it('parses a valid payload', () => {
    expect(transactionCreatedEventSchema.parse(validPayload)).toEqual(validPayload);
  });

  it('rejects a non-positive value', () => {
    expect(() => transactionCreatedEventSchema.parse({ ...validPayload, value: 0 })).toThrow();
  });

  it('rejects a malformed transactionExternalId', () => {
    expect(() =>
      transactionCreatedEventSchema.parse({ ...validPayload, transactionExternalId: 'nope' }),
    ).toThrow();
  });

  it('rejects a non-ISO createdAt', () => {
    expect(() =>
      transactionCreatedEventSchema.parse({ ...validPayload, createdAt: '13/08/2026' }),
    ).toThrow();
  });
});
