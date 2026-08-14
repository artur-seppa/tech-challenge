import { describe, expect, it } from 'vitest';
import { transactionStatusUpdatedEventSchema } from './transaction-status-updated.event';

describe('transactionStatusUpdatedEventSchema', () => {
  it('parses a valid "approved" payload', () => {
    const payload = {
      transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      status: 'approved',
    };

    expect(transactionStatusUpdatedEventSchema.parse(payload)).toEqual(payload);
  });

  it('parses a valid "rejected" payload', () => {
    const payload = {
      transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      status: 'rejected',
    };

    expect(transactionStatusUpdatedEventSchema.parse(payload)).toEqual(payload);
  });

  it('rejects a status outside the allowed enum', () => {
    const payload = {
      transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      status: 'pending',
    };

    expect(() => transactionStatusUpdatedEventSchema.parse(payload)).toThrow();
  });
});
