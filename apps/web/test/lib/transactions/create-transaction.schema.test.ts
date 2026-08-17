import { describe, expect, it } from 'vitest';
import {
  createTransactionFormSchema,
  MAX_TRANSACTION_VALUE,
} from '../../../src/lib/transactions/create-transaction.schema';

const validPayload = {
  accountExternalIdDebit: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
  accountExternalIdCredit: '3fa85f64-5717-4562-b3fc-2c963f66afa8',
  transferTypeId: 1,
  value: 120,
};

describe('createTransactionFormSchema', () => {
  it('parses a valid payload', () => {
    expect(createTransactionFormSchema.parse(validPayload)).toEqual(validPayload);
  });

  it('rejects a malformed accountExternalIdDebit', () => {
    const result = createTransactionFormSchema.safeParse({
      ...validPayload,
      accountExternalIdDebit: 'nope',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a non-positive value', () => {
    const result = createTransactionFormSchema.safeParse({ ...validPayload, value: 0 });

    expect(result.success).toBe(false);
  });

  it('rejects a non-integer transferTypeId', () => {
    const result = createTransactionFormSchema.safeParse({ ...validPayload, transferTypeId: 1.5 });

    expect(result.success).toBe(false);
  });

  it('accepts a value right at the NUMERIC(18,2) column limit', () => {
    const result = createTransactionFormSchema.safeParse({
      ...validPayload,
      value: MAX_TRANSACTION_VALUE,
    });

    expect(result.success).toBe(true);
  });

  it('rejects a value over the NUMERIC(18,2) column limit, with a field-level error', () => {
    // +1 alone wouldn't reliably fail here: IEEE-754 doubles can't distinguish adjacent
    // values at this magnitude (~1e16), so a delta needs to be large enough to actually
    // change the floating-point representation.
    const result = createTransactionFormSchema.safeParse({
      ...validPayload,
      value: MAX_TRANSACTION_VALUE * 10,
    });

    expect(result.success).toBe(false);
  });

  it('rejects Infinity (what "1e400" and similar overflow input becomes)', () => {
    // HTML's <input type="number"> accepts "1e400"; Number('1e400') === Infinity. Without
    // the .max() bound, this would pass .positive() here and only fail once
    // JSON.stringify silently turns it into `null` on the wire.
    const result = createTransactionFormSchema.safeParse({ ...validPayload, value: Infinity });

    expect(result.success).toBe(false);
  });

  it('rejects a value with more than 2 decimal places', () => {
    const result = createTransactionFormSchema.safeParse({ ...validPayload, value: 10.005 });

    expect(result.success).toBe(false);
  });

  it('accepts a value with exactly 2 decimal places', () => {
    const result = createTransactionFormSchema.safeParse({ ...validPayload, value: 10.05 });

    expect(result.success).toBe(true);
  });
});
