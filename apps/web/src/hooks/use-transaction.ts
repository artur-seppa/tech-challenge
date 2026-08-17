'use client';

import { useQuery } from '@tanstack/react-query';
import { useTransactionEventsStatus } from '../components/events-bridge';
import { getTransaction } from '../lib/transactions/api';

const POLL_INTERVAL_MS = 3000;

export function useTransaction(id: string) {
  const { degraded } = useTransactionEventsStatus();

  return useQuery({
    queryKey: ['transaction', id],
    queryFn: () => getTransaction(id),
    refetchInterval: (query) => {
      if (!degraded) return false;
      return query.state.data?.transactionStatus.name === 'pending' ? POLL_INTERVAL_MS : false;
    },
  });
}
