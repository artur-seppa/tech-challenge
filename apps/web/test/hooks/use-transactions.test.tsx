import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransactions } from '../../src/hooks/use-transactions';
import * as api from '../../src/lib/transactions/api';
import * as eventsBridge from '../../src/components/events-bridge';

vi.mock('../../src/lib/transactions/api');
vi.mock('../../src/components/events-bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/components/events-bridge')>();
  return { ...actual, useTransactionEventsStatus: vi.fn() };
});

const PENDING_RESULT = {
  data: [
    {
      transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      transactionType: { name: 'Pagamento' },
      transactionStatus: { name: 'pending' as const },
      value: 120,
      createdAt: '2026-08-14T10:00:00.000Z',
    },
  ],
  meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
};

function renderWithClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useTransactions({}, 1, 20), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe('useTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not set a refetch interval when there is a pending transaction but the SSE connection is healthy', async () => {
    // Fake timers are used for the whole test (not switched on partway through), so the
    // refetchInterval timer the hook schedules on mount is itself a fake timer under control.
    vi.useFakeTimers();
    vi.mocked(eventsBridge.useTransactionEventsStatus).mockReturnValue({ degraded: false });
    vi.mocked(api.listTransactions).mockResolvedValue(PENDING_RESULT);

    const { result } = renderWithClient();
    await vi.advanceTimersByTimeAsync(0);
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual(PENDING_RESULT);
    expect(api.listTransactions).toHaveBeenCalledTimes(1);

    // No direct way to read the resolved refetchInterval from the public API, so prove the
    // gating by advancing past the 3s poll window and confirming no second fetch happens.
    await vi.advanceTimersByTimeAsync(3000);
    expect(api.listTransactions).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('keeps polling every 3s when degraded and a pending transaction is visible', async () => {
    vi.useFakeTimers();
    vi.mocked(eventsBridge.useTransactionEventsStatus).mockReturnValue({ degraded: true });
    vi.mocked(api.listTransactions).mockResolvedValue(PENDING_RESULT);

    renderWithClient();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.listTransactions).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000);
    expect(api.listTransactions).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('does not poll when degraded but there is no pending transaction', async () => {
    vi.useFakeTimers();
    vi.mocked(eventsBridge.useTransactionEventsStatus).mockReturnValue({ degraded: true });
    vi.mocked(api.listTransactions).mockResolvedValue({
      ...PENDING_RESULT,
      data: [
        {
          ...PENDING_RESULT.data[0]!,
          transactionStatus: { name: 'approved' },
        },
      ],
    });

    renderWithClient();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.listTransactions).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000);
    expect(api.listTransactions).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
