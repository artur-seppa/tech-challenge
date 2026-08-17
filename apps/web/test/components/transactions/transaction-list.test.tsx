import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionList } from '../../../src/components/transactions/transaction-list';
import * as api from '../../../src/lib/transactions/api';
import { renderWithQueryClient } from '../../test-utils';

const { mockSearchParams } = vi.hoisted(() => ({
  mockSearchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock('../../../src/lib/transactions/api');

const noop = () => {};

beforeEach(() => {
  Array.from(mockSearchParams.keys()).forEach((key) => mockSearchParams.delete(key));
});

describe('TransactionList', () => {
  it('shows a loading state while fetching', () => {
    vi.mocked(api.listTransactions).mockReturnValue(new Promise(() => {}));

    renderWithQueryClient(
      <TransactionList filters={{}} page={1} pageSize={20} onPageChange={noop} />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i);
  });

  it('shows an error state when the request fails', async () => {
    vi.mocked(api.listTransactions).mockRejectedValue(new Error('boom'));

    renderWithQueryClient(
      <TransactionList filters={{}} page={1} pageSize={20} onPageChange={noop} />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível/i);
  });

  it('shows an empty state when there are no transactions', async () => {
    vi.mocked(api.listTransactions).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    renderWithQueryClient(
      <TransactionList filters={{}} page={1} pageSize={20} onPageChange={noop} />,
    );

    expect(await screen.findByText(/nenhuma transação encontrada/i)).toBeInTheDocument();
  });

  it('renders a card per transaction linking to its detail drawer', async () => {
    vi.mocked(api.listTransactions).mockResolvedValue({
      data: [
        {
          transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          transactionType: { name: 'Pagamento' },
          transactionStatus: { name: 'pending' },
          value: 120,
          createdAt: '2026-08-14T10:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    renderWithQueryClient(
      <TransactionList filters={{}} page={1} pageSize={20} onPageChange={noop} />,
    );

    const link = await screen.findByRole('link', { name: /pagamento/i });
    expect(link).toHaveAttribute('href', '?tx=3fa85f64-5717-4562-b3fc-2c963f66afa6');
    expect(screen.getByText('Pendente')).toBeInTheDocument();
  });

  it('preserves existing filter/page query params in the detail link', async () => {
    mockSearchParams.set('status', 'pending');
    mockSearchParams.set('page', '2');
    vi.mocked(api.listTransactions).mockResolvedValue({
      data: [
        {
          transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          transactionType: { name: 'Pagamento' },
          transactionStatus: { name: 'pending' },
          value: 120,
          createdAt: '2026-08-14T10:00:00.000Z',
        },
      ],
      meta: { page: 2, pageSize: 20, total: 21, totalPages: 2 },
    });

    renderWithQueryClient(
      <TransactionList
        filters={{ status: 'pending' }}
        page={2}
        pageSize={20}
        onPageChange={noop}
      />,
    );

    const link = await screen.findByRole('link', { name: /pagamento/i });
    expect(link).toHaveAttribute(
      'href',
      '?status=pending&page=2&tx=3fa85f64-5717-4562-b3fc-2c963f66afa6',
    );
  });
});
