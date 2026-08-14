import { z } from 'zod';

export const transactionCreatedEventSchema = z.object({
  transactionExternalId: z.uuid(),
  accountExternalIdDebit: z.uuid(),
  accountExternalIdCredit: z.uuid(),
  transferTypeId: z.number().int().positive(),
  value: z.number().positive(),
  createdAt: z.iso.datetime(),
});

export type TransactionCreatedEvent = z.infer<typeof transactionCreatedEventSchema>;
