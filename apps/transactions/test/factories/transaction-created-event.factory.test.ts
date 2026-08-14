import { transactionCreatedEventSchema } from '@tech-challenge/contracts';
import { describe, expect, it } from 'vitest';
import { makeTransactionCreatedEvent } from './transaction-created-event.factory';

describe('makeTransactionCreatedEvent', () => {
  it('produces a payload that satisfies the contract schema', () => {
    expect(() => transactionCreatedEventSchema.parse(makeTransactionCreatedEvent())).not.toThrow();
  });

  it('applies overrides', () => {
    const event = makeTransactionCreatedEvent({ value: 999 });

    expect(event.value).toBe(999);
  });
});
