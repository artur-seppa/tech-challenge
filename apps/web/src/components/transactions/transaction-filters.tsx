'use client';

import type { ChangeEvent } from 'react';
import type {
  TransactionFilters as Filters,
  TransactionStatusName,
} from '../../lib/transactions/types';
import { useTransferTypes } from '../../hooks/use-transfer-types';

export interface TransactionFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const inputClassName =
  'mt-1 rounded border border-ink-muted bg-surface px-2 py-1 text-sm focus:border-accent focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-accent';

// Reverses handleFromChange/handleToChange's local-midnight/local-end-of-day encoding back into
// the "YYYY-MM-DD" shape <input type="date"> expects, for filters pre-populated from the URL.
function toDateInputValue(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function TransactionFilters({ filters, onChange }: TransactionFiltersProps) {
  function update<K extends keyof Filters>(key: K, value: Filters[K] | undefined) {
    const next = { ...filters };

    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }

    onChange(next);
  }

  const transferTypesQuery = useTransferTypes();

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as TransactionStatusName | '';
    update('status', value === '' ? undefined : value);
  };

  const handleTransferTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    update('transferTypeId', value === '' ? undefined : Number(value));
  };

  const handleFromChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    // `value` is a local calendar date ("YYYY-MM-DD") from <input type="date">. Appending
    // "Z" would treat it as UTC midnight, shifting the filter window by the browser's UTC
    // offset. Omitting the offset makes the date-time string parse as *local* midnight per
    // the ECMA-262 date-time string spec, so toISOString() converts it to the correct UTC
    // instant for whatever timezone the user is actually in.
    update('from', value === '' ? undefined : new Date(`${value}T00:00:00`).toISOString());
  };

  const handleToChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    update('to', value === '' ? undefined : new Date(`${value}T23:59:59.999`).toISOString());
  };

  return (
    <fieldset className="flex flex-wrap items-end gap-4 rounded border border-rule bg-surface p-4">
      <legend className="sr-only">Filtros</legend>
      <label className="flex flex-col text-xs text-ink-muted uppercase tracking-wide">
        Status
        <select
          value={filters.status ?? ''}
          onChange={handleStatusChange}
          className={inputClassName}
        >
          <option value="">Todos</option>
          <option value="pending">Pendente</option>
          <option value="approved">Aprovada</option>
          <option value="rejected">Rejeitada</option>
        </select>
      </label>
      <label className="flex flex-col text-xs text-ink-muted uppercase tracking-wide">
        Tipo
        <select
          value={filters.transferTypeId ?? ''}
          onChange={handleTransferTypeChange}
          className={inputClassName}
        >
          <option value="">Todos</option>
          {transferTypesQuery.data?.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs text-ink-muted uppercase tracking-wide">
        De
        {/* Uncontrolled on purpose (defaultValue, not value) so React doesn't fight free typing;
            `key` forces a remount only when `filters.from` changes from outside. */}
        <input
          key={filters.from ?? 'from-empty'}
          type="date"
          defaultValue={filters.from ? toDateInputValue(filters.from) : ''}
          onChange={handleFromChange}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col text-xs text-ink-muted uppercase tracking-wide">
        Até
        <input
          key={filters.to ?? 'to-empty'}
          type="date"
          defaultValue={filters.to ? toDateInputValue(filters.to) : ''}
          onChange={handleToChange}
          className={inputClassName}
        />
      </label>
    </fieldset>
  );
}
