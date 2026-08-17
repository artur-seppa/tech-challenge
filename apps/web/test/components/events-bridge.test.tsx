import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventsBridge, useTransactionEventsStatus } from '../../src/components/events-bridge';

class FakeEventSource {
  onopen: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close(): void {}
}

function StatusProbe() {
  const { degraded } = useTransactionEventsStatus();
  return <p>degraded: {String(degraded)}</p>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EventsBridge', () => {
  it('provides degraded: false by default to consumers, and renders children', () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <EventsBridge>
          <StatusProbe />
        </EventsBridge>
      </QueryClientProvider>,
    );

    expect(screen.getByText('degraded: false')).toBeInTheDocument();
  });
});
