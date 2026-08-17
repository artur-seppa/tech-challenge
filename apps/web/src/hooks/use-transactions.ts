'use client';

import { useQuery } from '@tanstack/react-query';
import { useTransactionEventsStatus } from '../components/events-bridge';
import { listTransactions } from '../lib/transactions/api';
import type { TransactionFilters } from '../lib/transactions/types';

const POLL_INTERVAL_MS = 3000;

export function useTransactions(filters: TransactionFilters, page: number, pageSize: number) {
  const { degraded } = useTransactionEventsStatus();

  return useQuery({
    queryKey: ['transactions', filters, page, pageSize],
    queryFn: () => listTransactions(filters, page, pageSize),
    refetchInterval: (query) => {
      if (!degraded) return false;

      const hasPending = query.state.data?.data.some(
        (transaction) => transaction.transactionStatus.name === 'pending',
      );

      return hasPending ? POLL_INTERVAL_MS : false;
    },
  });
}
