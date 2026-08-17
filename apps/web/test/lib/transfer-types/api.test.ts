import { afterEach, describe, expect, it, vi } from 'vitest';
import { listTransferTypes } from '../../../src/lib/transfer-types/api';

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown> }): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
      ...response,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listTransferTypes', () => {
  it('requests /transfer-types and returns the parsed body', async () => {
    mockFetchOnce({ json: () => Promise.resolve([{ id: 1, name: 'Pagamento' }]) });

    const result = await listTransferTypes();

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain('/transfer-types');
    expect(result).toEqual([{ id: 1, name: 'Pagamento' }]);
  });
});
