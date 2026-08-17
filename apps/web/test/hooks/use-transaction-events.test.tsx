import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTransactionEvents } from '../../src/hooks/use-transaction-events';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }
}

function renderWithClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = renderHook(() => useTransactionEvents(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  return { ...view, queryClient };
}

afterEach(() => {
  FakeEventSource.instances = [];
  vi.unstubAllGlobals();
});

describe('useTransactionEvents', () => {
  it('opens exactly one EventSource on mount and closes it on unmount', () => {
    vi.stubGlobal('EventSource', FakeEventSource);

    const { unmount } = renderWithClient();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0]?.closed).toBe(false);

    unmount();
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
  });

  it('updates the cached transaction, reconciles its detail, and invalidates the list on a valid message', () => {
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', FakeEventSource);
    const { queryClient } = renderWithClient();
    const source = FakeEventSource.instances[0];
    if (!source) throw new Error('EventSource not created');

    queryClient.setQueryData(['transaction', '3fa85f64-5717-4562-b3fc-2c963f66afa6'], {
      transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      transactionStatus: { name: 'pending' },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    source.onmessage?.({
      data: JSON.stringify({
        transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        status: 'approved',
      }),
    } as MessageEvent<string>);

    expect(
      queryClient.getQueryData(['transaction', '3fa85f64-5717-4562-b3fc-2c963f66afa6']),
    ).toEqual({
      transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      transactionStatus: { name: 'approved' },
    });
    // The detail reconciliation invalidate fires immediately, not debounced: each message is
    // for a specific transaction id, so there's nothing to coalesce.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['transaction', '3fa85f64-5717-4562-b3fc-2c963f66afa6'],
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['transactions'] });

    vi.advanceTimersByTime(250);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    vi.useRealTimers();
  });

  it('coalesces a burst of messages into a single debounced list invalidation', () => {
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', FakeEventSource);
    const { queryClient } = renderWithClient();
    const source = FakeEventSource.instances[0];
    if (!source) throw new Error('EventSource not created');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    for (let i = 0; i < 3; i += 1) {
      source.onmessage?.({
        data: JSON.stringify({
          transactionExternalId: `3fa85f64-5717-4562-b3fc-2c963f66af${i}`,
          status: 'approved',
        }),
      } as MessageEvent<string>);
      vi.advanceTimersByTime(50);
    }
    vi.advanceTimersByTime(250);

    const listInvalidations = invalidateSpy.mock.calls.filter(
      (call) => call[0]?.queryKey?.[0] === 'transactions',
    );
    expect(listInvalidations).toHaveLength(1);
    vi.useRealTimers();
  });

  it('ignores a message that fails shape validation', () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    const { queryClient } = renderWithClient();
    const source = FakeEventSource.instances[0];
    if (!source) throw new Error('EventSource not created');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    source.onmessage?.({ data: JSON.stringify({ nope: true }) } as MessageEvent<string>);

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('becomes degraded after 5 consecutive connection errors', () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    const { result, rerender } = renderWithClient();
    const source = FakeEventSource.instances[0];
    if (!source) throw new Error('EventSource not created');

    expect(result.current.degraded).toBe(false);

    for (let i = 0; i < 5; i += 1) {
      source.onerror?.();
    }
    rerender();

    expect(result.current.degraded).toBe(true);
  });

  it('reaches degraded even when every failed connection briefly opens before dying (flapping connection)', () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    const { result, rerender } = renderWithClient();
    const source = FakeEventSource.instances[0];
    if (!source) throw new Error('EventSource not created');

    // Each cycle: the connection opens (onopen fires) and then dies without ever delivering a
    // message (onerror fires next). Under the old behavior (onopen reset the counter), this
    // would never reach `degraded` no matter how many times it repeated: the bug this guards.
    for (let i = 0; i < 5; i += 1) {
      source.onopen?.();
      source.onerror?.();
    }
    rerender();

    expect(result.current.degraded).toBe(true);
  });

  it('resets the error count and clears degraded once a valid message is actually received', () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    const { result, rerender } = renderWithClient();
    const source = FakeEventSource.instances[0];
    if (!source) throw new Error('EventSource not created');

    for (let i = 0; i < 5; i += 1) {
      source.onerror?.();
    }
    rerender();
    expect(result.current.degraded).toBe(true);

    source.onmessage?.({
      data: JSON.stringify({
        transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        status: 'approved',
      }),
    } as MessageEvent<string>);
    rerender();

    expect(result.current.degraded).toBe(false);
  });

  it('reconciles broadly on reconnect after an error (onopen after onerror)', () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    const { queryClient, result, rerender } = renderWithClient();
    const source = FakeEventSource.instances[0];
    if (!source) throw new Error('EventSource not created');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    source.onerror?.();
    source.onopen?.();
    rerender();

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['transaction'] });
    // A single error never reaches the degraded threshold on its own; this test's job is only
    // to prove the reconciliation invalidate fires on reconnect.
    expect(result.current.degraded).toBe(false);
  });
});
