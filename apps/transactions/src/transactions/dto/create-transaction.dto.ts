import { z } from 'zod';

// TRANSACTION_VALUE_MAX in the root .env, mirrored by the frontend's NEXT_PUBLIC_TRANSACTION_VALUE_MAX.
// Default is Number.MAX_SAFE_INTEGER, not the column's literal NUMERIC(18,2) ceiling: see
// DECISIONS.md "Modelagem de dados da transação" for why that literal isn't a safe JS boundary.
export const MAX_TRANSACTION_VALUE = Number(
  process.env.TRANSACTION_VALUE_MAX ?? String(Number.MAX_SAFE_INTEGER),
);

// The `value` column is NUMERIC(18,2): anything with more than 2 decimal places would be
// silently rounded by Postgres on insert instead of rejected, so the API's response could
// differ from what the client submitted. toFixed(2) rounds; comparing back to the original
// catches any value that rounding would have changed.
function hasAtMostTwoDecimalPlaces(value: number): boolean {
  return Number(value.toFixed(2)) === value;
}

export const createTransactionSchema = z.object({
  accountExternalIdDebit: z.uuid(),
  accountExternalIdCredit: z.uuid(),
  transferTypeId: z.number().int().positive(),
  value: z
    .number()
    .positive()
    .max(MAX_TRANSACTION_VALUE)
    .refine(hasAtMostTwoDecimalPlaces, 'No máximo 2 casas decimais'),
});

export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;
