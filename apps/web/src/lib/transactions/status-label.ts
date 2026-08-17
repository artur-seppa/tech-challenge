import type { TransactionStatusName } from './types';

const LABELS: Record<TransactionStatusName, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
};

export function statusLabel(status: TransactionStatusName): string {
  return LABELS[status];
}
