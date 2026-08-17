'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useTransactionEvents } from '../hooks/use-transaction-events';

interface TransactionEventsStatus {
  degraded: boolean;
}

const TransactionEventsStatusContext = createContext<TransactionEventsStatus>({
  degraded: false,
});

export function useTransactionEventsStatus(): TransactionEventsStatus {
  return useContext(TransactionEventsStatusContext);
}

export function EventsBridge({ children }: { children: ReactNode }) {
  const status = useTransactionEvents();

  return (
    <TransactionEventsStatusContext.Provider value={status}>
      {children}
    </TransactionEventsStatusContext.Provider>
  );
}
