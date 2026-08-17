import { statusLabel } from '../../lib/transactions/status-label';
import type { TransactionStatusName } from '../../lib/transactions/types';

const STAMP_STYLES: Record<TransactionStatusName, string> = {
  pending: 'border-stamp-pending text-stamp-pending',
  approved: 'border-stamp-approved text-stamp-approved',
  rejected: 'border-stamp-rejected text-stamp-rejected',
};

export function StatusBadge({ status }: { status: TransactionStatusName }) {
  return (
    <span
      className={`inline-flex -rotate-2 items-center rounded border-2 px-2 py-0.5 font-display text-xs font-semibold tracking-widest uppercase ${STAMP_STYLES[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}
