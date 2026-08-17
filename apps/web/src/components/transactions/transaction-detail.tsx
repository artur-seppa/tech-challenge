'use client';

import { useTransaction } from '../../hooks/use-transaction';
import { currencyFormatter, dateFormatter } from '../../lib/transactions/formatters';
import { StatusBadge } from './status-badge';

export function TransactionDetail({ id }: { id: string }) {
  const { data, isLoading, isError } = useTransaction(id);

  if (isLoading) {
    return <p role="status">Carregando transação…</p>;
  }

  if (isError || !data) {
    return <p role="alert">Não foi possível carregar essa transação.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-dashed border-rule pb-4">
        <p className="font-display text-2xl font-semibold tabular-nums">
          {currencyFormatter.format(data.value)}
        </p>
        <StatusBadge status={data.transactionStatus.name} />
      </div>
      <dl className="grid grid-cols-1 gap-4">
        <div>
          <dt className="text-xs text-ink-muted uppercase tracking-wide">Id</dt>
          <dd className="font-display text-sm">{data.transactionExternalId}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted uppercase tracking-wide">Tipo</dt>
          <dd>{data.transactionType.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted uppercase tracking-wide">Criada em</dt>
          <dd className="font-display text-sm">{dateFormatter.format(new Date(data.createdAt))}</dd>
        </div>
      </dl>
    </div>
  );
}
