import type { TransactionCreatedEvent } from '@tech-challenge/contracts';
import { faker } from '@faker-js/faker';

export function makeTransactionCreatedEvent(
  overrides: Partial<TransactionCreatedEvent> = {},
): TransactionCreatedEvent {
  return {
    transactionExternalId: faker.string.uuid(),
    accountExternalIdDebit: faker.string.uuid(),
    accountExternalIdCredit: faker.string.uuid(),
    transferTypeId: faker.number.int({ min: 1, max: 5 }),
    value: faker.number.float({ min: 1, max: 5000, fractionDigits: 2 }),
    createdAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}
