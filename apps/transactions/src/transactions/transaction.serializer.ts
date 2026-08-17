import type { TransactionRecord } from './transaction.repository';

export interface SerializedTransaction {
  transactionExternalId: string;
  transactionType: { name: string };
  transactionStatus: { name: string };
  value: number;
  createdAt: string;
}

export function serializeTransaction(transaction: TransactionRecord): SerializedTransaction {
  return {
    transactionExternalId: transaction.id,
    transactionType: { name: transaction.transferTypeName },
    transactionStatus: { name: transaction.status },
    value: transaction.value,
    createdAt: transaction.createdAt.toISOString(),
  };
}
