import { describe, expect, it } from 'vitest';
import { createTransactionSchema, MAX_TRANSACTION_VALUE } from './create-transaction.dto';

const validPayload = {
  accountExternalIdDebit: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
  accountExternalIdCredit: '3fa85f64-5717-4562-b3fc-2c963f66afa8',
  transferTypeId: 1,
  value: 120,
};

describe('createTransactionSchema', () => {
  it('parses a valid payload', () => {
    expect(createTransactionSchema.parse(validPayload)).toEqual(validPayload);
  });

  it('rejects a non-positive value', () => {
    expect(() => createTransactionSchema.parse({ ...validPayload, value: 0 })).toThrow();
  });

  it('rejects a malformed accountExternalIdDebit', () => {
    expect(() =>
      createTransactionSchema.parse({ ...validPayload, accountExternalIdDebit: 'nope' }),
    ).toThrow();
  });

  it('rejects a non-integer transferTypeId', () => {
    expect(() => createTransactionSchema.parse({ ...validPayload, transferTypeId: 1.5 })).toThrow();
  });

  it('accepts a value right at the NUMERIC(18,2) column limit', () => {
    expect(
      createTransactionSchema.parse({ ...validPayload, value: MAX_TRANSACTION_VALUE }),
    ).toEqual({ ...validPayload, value: MAX_TRANSACTION_VALUE });
  });

  it('rejects a value over the NUMERIC(18,2) column limit', () => {
    // +1 alone wouldn't reliably fail here: IEEE-754 doubles can't distinguish adjacent
    // values at this magnitude (~1e16), so a delta needs to be large enough to actually
    // change the floating-point representation.
    expect(() =>
      createTransactionSchema.parse({ ...validPayload, value: MAX_TRANSACTION_VALUE * 10 }),
    ).toThrow();
  });

  it('rejects Infinity (what a value too large for a JS number becomes)', () => {
    // JSON.stringify turns Infinity into `null` before this schema ever sees a number, but
    // Infinity itself must still fail here as defense in depth for any non-JSON caller.
    expect(() => createTransactionSchema.parse({ ...validPayload, value: Infinity })).toThrow();
  });

  it('rejects a value with more than 2 decimal places', () => {
    expect(() => createTransactionSchema.parse({ ...validPayload, value: 10.005 })).toThrow();
  });

  it('accepts a value with exactly 2 decimal places', () => {
    expect(createTransactionSchema.parse({ ...validPayload, value: 10.05 })).toEqual({
      ...validPayload,
      value: 10.05,
    });
  });

  it('accepts a value with 1 decimal place', () => {
    expect(createTransactionSchema.parse({ ...validPayload, value: 10.5 })).toEqual({
      ...validPayload,
      value: 10.5,
    });
  });

  it('accepts an integer value', () => {
    expect(createTransactionSchema.parse({ ...validPayload, value: 10 })).toEqual({
      ...validPayload,
      value: 10,
    });
  });
});
