export const TRANSACTION_REPOSITORY = 'TRANSACTION_REPOSITORY';

export type TransactionStatusValue = 'pending' | 'approved' | 'rejected';

export interface TransactionRecord {
  id: string;
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
  transferTypeId: number;
  transferTypeName: string;
  value: number;
  status: TransactionStatusValue;
  createdAt: Date;
}

export interface CreateTransactionInput {
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
  transferTypeId: number;
  value: number;
  idempotencyKey?: string;
}

export interface CreateTransactionResult {
  transaction: TransactionRecord;
  /** false when `idempotencyKey` matched an existing row instead of creating a new one. */
  wasCreated: boolean;
}

export interface ListTransactionsFilter {
  status?: TransactionStatusValue;
  transferTypeId?: number;
  from?: Date;
  to?: Date;
}

export interface ListTransactionsParams {
  filter: ListTransactionsFilter;
  page: number;
  pageSize: number;
}

export interface StalePendingTransaction {
  id: string;
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
  transferTypeId: number;
  value: number;
  createdAt: Date;
}

export interface TransactionRepository {
  /**
   * When `input.idempotencyKey` already belongs to a row, returns that row (`wasCreated: false`)
   * instead of creating a duplicate. Race-safe: always attempts the insert and recovers from the
   * DB's unique constraint violation, never pre-checks then inserts.
   */
  createIdempotent(input: CreateTransactionInput): Promise<CreateTransactionResult>;
  findByExternalId(externalId: string): Promise<TransactionRecord | null>;
  findMany(params: ListTransactionsParams): Promise<{ data: TransactionRecord[]; total: number }>;
  updateStatusByExternalId(
    externalId: string,
    status: TransactionStatusValue,
  ): Promise<TransactionRecord | null>;
  /**
   * Atomically claims up to `limit` transactions `pending` since before `olderThan`, bumping
   * their `updatedAt` in the same statement. `FOR UPDATE SKIP LOCKED` makes concurrent sweeps
   * (this instance or another replica) never claim the same row twice.
   */
  claimStalePending(olderThan: Date, limit: number): Promise<StalePendingTransaction[]>;
}
