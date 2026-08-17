'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTransactions } from '../../hooks/use-transactions';
import { currencyFormatter, dateFormatter } from '../../lib/transactions/formatters';
import { withSearchParams } from '../../lib/query-params';
import type { TransactionFilters } from '../../lib/transactions/types';
import { StatusBadge } from './status-badge';

export interface TransactionListProps {
  filters: TransactionFilters;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function TransactionList({ filters, page, pageSize, onPageChange }: TransactionListProps) {
  const { data, isLoading, isError } = useTransactions(filters, page, pageSize);
  // A bare `?tx=...` href would replace the whole query string, dropping any active filters/page.
  const searchParams = useSearchParams();

  if (isLoading) {
    return <p role="status">Carregando transações…</p>;
  }

  if (isError) {
    return <p role="alert">Não foi possível carregar as transações. Tente novamente.</p>;
  }

  if (!data || data.data.length === 0) {
    return <p>Nenhuma transação encontrada.</p>;
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.data.map((transaction) => (
          <li key={transaction.transactionExternalId}>
            <Link
              href={`?${withSearchParams(searchParams, { tx: transaction.transactionExternalId, new: undefined })}`}
              className="block rounded border-t-2 border-dashed border-rule bg-surface p-4 shadow-sm transition hover:shadow-md"
            >
              <p className="font-display text-xs text-ink-muted">
                #{transaction.transactionExternalId.slice(0, 8)}
              </p>
              <p className="mt-1 text-sm">{transaction.transactionType.name}</p>
              <p className="mt-2 text-right font-display text-lg font-semibold tabular-nums">
                {currencyFormatter.format(transaction.value)}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <StatusBadge status={transaction.transactionStatus.name} />
                <span className="font-display text-xs text-ink-muted">
                  {dateFormatter.format(new Date(transaction.createdAt))}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <nav aria-label="Paginação" className="mt-4 flex items-center gap-4 text-sm">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded border border-rule px-3 py-1 disabled:opacity-40"
        >
          Anterior
        </button>
        <span>
          Página {data.meta.page} de {Math.max(data.meta.totalPages, 1)}
        </span>
        <button
          type="button"
          disabled={page >= data.meta.totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded border border-rule px-3 py-1 disabled:opacity-40"
        >
          Próxima
        </button>
      </nav>
    </>
  );
}
