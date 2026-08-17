import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../src/lib/api-client';
import {
  createTransaction,
  getTransaction,
  listTransactions,
} from '../../../src/lib/transactions/api';

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown> }): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      ...response,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listTransactions', () => {
  it('only includes defined filters in the query string', async () => {
    mockFetchOnce({ json: () => Promise.resolve({ data: [], meta: {} }) });

    await listTransactions({}, 1, 20);

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain('page=1');
    expect(url).toContain('pageSize=20');
    expect(url).not.toContain('status=');
    expect(url).not.toContain('transferTypeId=');
  });

  it('includes status, transferTypeId, from and to when provided', async () => {
    mockFetchOnce({ json: () => Promise.resolve({ data: [], meta: {} }) });

    await listTransactions(
      { status: 'approved', transferTypeId: 2, from: '2026-08-01', to: '2026-08-14' },
      2,
      10,
    );

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain('status=approved');
    expect(url).toContain('transferTypeId=2');
    expect(url).toContain('from=2026-08-01');
    expect(url).toContain('to=2026-08-14');
  });
});

describe('getTransaction', () => {
  it('requests the transaction by external id', async () => {
    mockFetchOnce({ json: () => Promise.resolve({ transactionExternalId: 'id-1' }) });

    await getTransaction('id-1');

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain('/transactions/id-1');
  });

  it('throws ApiError when the response is not ok', async () => {
    mockFetchOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'not found' }),
    });

    await expect(getTransaction('missing')).rejects.toThrow(ApiError);
  });
});

describe('createTransaction', () => {
  it('posts the payload as JSON', async () => {
    mockFetchOnce({ json: () => Promise.resolve({ transactionExternalId: 'id-1' }) });
    const input = {
      accountExternalIdDebit: 'a',
      accountExternalIdCredit: 'b',
      transferTypeId: 1,
      value: 120,
    };

    await createTransaction(input, 'idempotency-key-1');

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(input);
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('idempotency-key-1');
  });
});
