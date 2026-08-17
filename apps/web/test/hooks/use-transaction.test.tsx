import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransaction } from '../../src/hooks/use-transaction';
import * as api from '../../src/lib/transactions/api';
import * as eventsBridge from '../../src/components/events-bridge';

vi.mock('../../src/lib/transactions/api');
vi.mock('../../src/components/events-bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/components/events-bridge')>();
  return { ...actual, useTransactionEventsStatus: vi.fn() };
});

const PENDING_TRANSACTION = {
  transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  transactionType: { name: 'Pagamento' },
  transactionStatus: { name: 'pending' as const },
  value: 120,
  createdAt: '2026-08-14T10:00:00.000Z',
};

function renderWithClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useTransaction('3fa85f64-5717-4562-b3fc-2c963f66afa6'), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe('useTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps polling every 3s when degraded and the transaction is pending', async () => {
    vi.useFakeTimers();
    vi.mocked(eventsBridge.useTransactionEventsStatus).mockReturnValue({ degraded: true });
    vi.mocked(api.getTransaction).mockResolvedValue(PENDING_TRANSACTION);

    renderWithClient();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.getTransaction).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000);
    expect(api.getTransaction).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('does not poll when the SSE connection is healthy, even if pending', async () => {
    vi.useFakeTimers();
    vi.mocked(eventsBridge.useTransactionEventsStatus).mockReturnValue({ degraded: false });
    vi.mocked(api.getTransaction).mockResolvedValue(PENDING_TRANSACTION);

    renderWithClient();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.getTransaction).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000);
    expect(api.getTransaction).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
