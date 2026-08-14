import { transactionStatusUpdatedEventSchema } from '@tech-challenge/contracts';
import { describe, expect, it } from 'vitest';
import { makeTransactionStatusUpdatedEvent } from './transaction-status-updated-event.factory';

describe('makeTransactionStatusUpdatedEvent', () => {
  it('produces a payload that satisfies the contract schema', () => {
    expect(() =>
      transactionStatusUpdatedEventSchema.parse(makeTransactionStatusUpdatedEvent()),
    ).not.toThrow();
  });

  it('applies overrides', () => {
    const event = makeTransactionStatusUpdatedEvent({ status: 'rejected' });

    expect(event.status).toBe('rejected');
  });
});
