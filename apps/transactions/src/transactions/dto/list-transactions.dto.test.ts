import { describe, expect, it } from 'vitest';
import { listTransactionsQuerySchema } from './list-transactions.dto';

describe('listTransactionsQuerySchema', () => {
  it('defaults page and pageSize when omitted', () => {
    expect(listTransactionsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('coerces page, pageSize and transferTypeId from query strings', () => {
    expect(
      listTransactionsQuerySchema.parse({ page: '2', pageSize: '10', transferTypeId: '3' }),
    ).toEqual({ page: 2, pageSize: 10, transferTypeId: 3 });
  });

  it('accepts a valid status filter', () => {
    expect(listTransactionsQuerySchema.parse({ status: 'approved' }).status).toBe('approved');
  });

  it('rejects an invalid status filter', () => {
    expect(() => listTransactionsQuerySchema.parse({ status: 'unknown' })).toThrow();
  });

  it('rejects a pageSize above the maximum', () => {
    expect(() => listTransactionsQuerySchema.parse({ pageSize: '101' })).toThrow();
  });

  it('accepts an ISO from/to date range', () => {
    const result = listTransactionsQuerySchema.parse({
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-14T23:59:59.999Z',
    });

    expect(result.from).toBe('2026-08-01T00:00:00.000Z');
    expect(result.to).toBe('2026-08-14T23:59:59.999Z');
  });

  it('rejects a non-ISO from date', () => {
    expect(() => listTransactionsQuerySchema.parse({ from: '01/08/2026' })).toThrow();
  });
});
