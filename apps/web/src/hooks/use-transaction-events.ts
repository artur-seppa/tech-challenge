'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { Transaction, TransactionStatusName } from '../lib/transactions/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const DEGRADED_THRESHOLD = 5;
// Coalesces a burst of status-update messages (many transactions resolving close together)
// into one list refetch instead of one per message. The detail view doesn't need this: it's
// already kept correct by the direct setQueryData patch per message.
const LIST_INVALIDATE_DEBOUNCE_MS = 250;

interface TransactionStatusUpdatedMessage {
  transactionExternalId: string;
  status: Exclude<TransactionStatusName, 'pending'>;
}

function isTransactionStatusUpdatedMessage(
  value: unknown,
): value is TransactionStatusUpdatedMessage {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.transactionExternalId === 'string' &&
    (candidate.status === 'approved' || candidate.status === 'rejected')
  );
}

export function useTransactionEvents(): { degraded: boolean } {
  const queryClient = useQueryClient();
  const [degraded, setDegraded] = useState(false);
  const consecutiveErrorsRef = useRef(0);
  const listInvalidateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const source = new EventSource(`${API_URL}/transactions/notifications/events`);

    source.onmessage = (event: MessageEvent<string>) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }

      if (!isTransactionStatusUpdatedMessage(parsed)) return;

      // A valid message is the real proof the connection works; reset here, not in `onopen`.
      // A connection that opens then dies before delivering anything must not erase progress
      // toward `degraded`, or that flapping pattern would loop forever without falling back.
      consecutiveErrorsRef.current = 0;
      setDegraded(false);

      const { transactionExternalId, status } = parsed;

      queryClient.setQueryData<Transaction>(
        ['transaction', transactionExternalId],
        (current) => current && { ...current, transactionStatus: { name: status } },
      );
      // Reconciles the optimistic patch above against the server shortly after: if the DB
      // write behind this broadcast ever fails (the two are independent Kafka consumers with
      // no ordering guarantee), this background refetch is what corrects the drift.
      void queryClient.invalidateQueries({ queryKey: ['transaction', transactionExternalId] });

      if (listInvalidateTimeoutRef.current) clearTimeout(listInvalidateTimeoutRef.current);
      listInvalidateTimeoutRef.current = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      }, LIST_INVALIDATE_DEBOUNCE_MS);
    };

    source.onerror = () => {
      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current >= DEGRADED_THRESHOLD) {
        setDegraded(true);
      }
    };

    source.onopen = () => {
      if (consecutiveErrorsRef.current > 0) {
        void queryClient.invalidateQueries({ queryKey: ['transactions'] });
        void queryClient.invalidateQueries({ queryKey: ['transaction'] });
      }
    };

    return () => {
      source.close();
      if (listInvalidateTimeoutRef.current) clearTimeout(listInvalidateTimeoutRef.current);
    };
  }, [queryClient]);

  return { degraded };
}
