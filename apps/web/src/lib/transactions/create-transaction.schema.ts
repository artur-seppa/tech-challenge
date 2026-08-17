import { z } from 'zod';

// NEXT_PUBLIC_TRANSACTION_VALUE_MAX in the root .env, mirrored by the backend's TRANSACTION_VALUE_MAX.
// Default is Number.MAX_SAFE_INTEGER, not the column's literal NUMERIC(18,2) ceiling: see
// DECISIONS.md "Modelagem de dados da transação". Also bounds "1e400"-style overflow to
// Infinity, which JSON.stringify would otherwise turn into a silent `null` on the wire.
export const MAX_TRANSACTION_VALUE = Number(
  process.env.NEXT_PUBLIC_TRANSACTION_VALUE_MAX ?? String(Number.MAX_SAFE_INTEGER),
);

// The `value` column is NUMERIC(18,2): anything with more than 2 decimal places would be
// silently rounded by Postgres on insert instead of rejected by the backend's own copy of
// this check, so catch it here too with a real field message.
function hasAtMostTwoDecimalPlaces(value: number): boolean {
  return Number(value.toFixed(2)) === value;
}

export const createTransactionFormSchema = z.object({
  accountExternalIdDebit: z.uuid(),
  accountExternalIdCredit: z.uuid(),
  transferTypeId: z.number().int().positive(),
  value: z
    .number()
    .positive()
    .max(MAX_TRANSACTION_VALUE)
    .refine(hasAtMostTwoDecimalPlaces, 'No máximo 2 casas decimais'),
});

export type CreateTransactionFormValues = z.infer<typeof createTransactionFormSchema>;
