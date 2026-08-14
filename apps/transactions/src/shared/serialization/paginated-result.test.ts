import { describe, expect, it } from 'vitest';
import { toPaginatedResult } from './paginated-result';

describe('toPaginatedResult', () => {
  it('wraps data with pagination meta', () => {
    const result = toPaginatedResult(['a', 'b'], { page: 1, pageSize: 10, total: 25 });

    expect(result).toEqual({
      data: ['a', 'b'],
      meta: { page: 1, pageSize: 10, total: 25, totalPages: 3 },
    });
  });

  it('returns zero total pages for an empty result set', () => {
    const result = toPaginatedResult([], { page: 1, pageSize: 10, total: 0 });

    expect(result.meta.totalPages).toBe(0);
  });
});
