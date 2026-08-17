export type TransactionStatusName = 'pending' | 'approved' | 'rejected';

export interface Transaction {
  transactionExternalId: string;
  transactionType: { name: string };
  transactionStatus: { name: TransactionStatusName };
  value: number;
  createdAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface TransactionFilters {
  status?: TransactionStatusName;
  transferTypeId?: number;
  from?: string;
  to?: string;
}
