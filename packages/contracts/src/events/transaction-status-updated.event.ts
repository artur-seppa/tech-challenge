import { z } from 'zod';

export const transactionStatusUpdatedEventSchema = z.object({
  transactionExternalId: z.uuid(),
  status: z.enum(['approved', 'rejected']),
});

export type TransactionStatusUpdatedEvent = z.infer<typeof transactionStatusUpdatedEventSchema>;
