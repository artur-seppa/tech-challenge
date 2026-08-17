import { request } from '../api-client';
import type { PaginatedResult, Transaction, TransactionFilters } from './types';

export interface CreateTransactionInput {
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
  transferTypeId: number;
  value: number;
}

export function listTransactions(
  filters: TransactionFilters,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<Transaction>> {
  const params = new URLSearchParams();

  if (filters.status) params.set('status', filters.status);
  if (filters.transferTypeId !== undefined) {
    params.set('transferTypeId', String(filters.transferTypeId));
  }
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));

  return request(`/transactions?${params.toString()}`);
}

export function getTransaction(id: string): Promise<Transaction> {
  return request(`/transactions/${id}`);
}

export function createTransaction(
  input: CreateTransactionInput,
  idempotencyKey: string,
): Promise<Transaction> {
  return request('/transactions', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}
