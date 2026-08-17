import { z } from 'zod';

export const listTransactionsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  transferTypeId: z.coerce.number().int().positive().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type ListTransactionsQueryDto = z.infer<typeof listTransactionsQuerySchema>;
