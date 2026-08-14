import type { TransactionStatusUpdatedEvent } from '@tech-challenge/contracts';
import { faker } from '@faker-js/faker';

export function makeTransactionStatusUpdatedEvent(
  overrides: Partial<TransactionStatusUpdatedEvent> = {},
): TransactionStatusUpdatedEvent {
  return {
    transactionExternalId: faker.string.uuid(),
    status: faker.helpers.arrayElement(['approved', 'rejected']),
    ...overrides,
  };
}
