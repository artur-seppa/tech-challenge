import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransactionDetail } from '../../../src/components/transactions/transaction-detail';
import * as api from '../../../src/lib/transactions/api';
import { renderWithQueryClient } from '../../test-utils';

vi.mock('../../../src/lib/transactions/api');

describe('TransactionDetail', () => {
  it('shows a loading state while fetching', () => {
    vi.mocked(api.getTransaction).mockReturnValue(new Promise(() => {}));

    renderWithQueryClient(<TransactionDetail id="3fa85f64-5717-4562-b3fc-2c963f66afa6" />);

    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i);
  });

  it('shows an error state when the transaction is not found', async () => {
    vi.mocked(api.getTransaction).mockRejectedValue(new Error('not found'));

    renderWithQueryClient(<TransactionDetail id="missing" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível/i);
  });

  it('renders the transaction details when available', async () => {
    vi.mocked(api.getTransaction).mockResolvedValue({
      transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      transactionType: { name: 'Pagamento' },
      transactionStatus: { name: 'approved' },
      value: 250.5,
      createdAt: '2026-08-14T10:00:00.000Z',
    });

    renderWithQueryClient(<TransactionDetail id="3fa85f64-5717-4562-b3fc-2c963f66afa6" />);

    expect(await screen.findByText('Pagamento')).toBeInTheDocument();
    expect(screen.getByText('Aprovada')).toBeInTheDocument();
    expect(screen.getByText(/250,50/)).toBeInTheDocument();
  });
});
