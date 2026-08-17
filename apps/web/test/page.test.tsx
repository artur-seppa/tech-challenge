import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../src/app/page';
import * as api from '../src/lib/transactions/api';
import * as transferTypesApi from '../src/lib/transfer-types/api';
import { renderWithQueryClient } from './test-utils';

const { mockPush, mockReplace, mockSearchParams } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockSearchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/',
  useSearchParams: () => mockSearchParams,
}));

vi.mock('../src/lib/transactions/api');
vi.mock('../src/lib/transfer-types/api');

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  Array.from(mockSearchParams.keys()).forEach((key) => mockSearchParams.delete(key));
  vi.mocked(transferTypesApi.listTransferTypes).mockResolvedValue([]);
});

describe('Home page', () => {
  it('renders a heading announcing the dashboard', () => {
    vi.mocked(api.listTransactions).mockReturnValue(new Promise(() => {}));

    renderWithQueryClient(<Page />);

    expect(screen.getByRole('heading', { name: /transações/i })).toBeInTheDocument();
  });

  it('shows a loading state while the list is fetching', () => {
    vi.mocked(api.listTransactions).mockReturnValue(new Promise(() => {}));

    renderWithQueryClient(<Page />);

    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i);
  });

  it('shows an empty state when there are no transactions', async () => {
    vi.mocked(api.listTransactions).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    renderWithQueryClient(<Page />);

    expect(await screen.findByText(/nenhuma transação encontrada/i)).toBeInTheDocument();
  });

  it('does not render any drawer when no tx/new param is set', () => {
    vi.mocked(api.listTransactions).mockReturnValue(new Promise(() => {}));

    renderWithQueryClient(<Page />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the transaction detail drawer when the tx param is set', async () => {
    mockSearchParams.set('tx', '3fa85f64-5717-4562-b3fc-2c963f66afa6');
    vi.mocked(api.listTransactions).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.getTransaction).mockResolvedValue({
      transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      transactionType: { name: 'Pagamento' },
      transactionStatus: { name: 'approved' },
      value: 250.5,
      createdAt: '2026-08-14T10:00:00.000Z',
    });

    renderWithQueryClient(<Page />);

    expect(
      await screen.findByRole('dialog', { name: /detalhe da transação/i }),
    ).toBeInTheDocument();
  });

  it('opens the create transaction drawer when the new param is set', () => {
    mockSearchParams.set('new', '1');
    vi.mocked(api.listTransactions).mockReturnValue(new Promise(() => {}));

    renderWithQueryClient(<Page />);

    expect(screen.getByRole('dialog', { name: /nova transação/i })).toBeInTheDocument();
  });

  it('pushes the bare path when a drawer requests close', async () => {
    mockSearchParams.set('new', '1');
    vi.mocked(api.listTransactions).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    renderWithQueryClient(<Page />);
    await user.click(screen.getByRole('button', { name: /fechar/i }));

    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('preserves existing filters/page when a drawer requests close', async () => {
    mockSearchParams.set('new', '1');
    mockSearchParams.set('status', 'pending');
    vi.mocked(api.listTransactions).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    renderWithQueryClient(<Page />);
    await user.click(screen.getByRole('button', { name: /fechar/i }));

    expect(mockPush).toHaveBeenCalledWith('/?status=pending');
  });

  it('reads filters and page from the URL on load', async () => {
    mockSearchParams.set('status', 'approved');
    mockSearchParams.set('page', '2');
    vi.mocked(api.listTransactions).mockResolvedValue({
      data: [],
      meta: { page: 2, pageSize: 9, total: 0, totalPages: 1 },
    });

    renderWithQueryClient(<Page />);
    await screen.findByText(/nenhuma transação encontrada/i);

    expect(api.listTransactions).toHaveBeenCalledWith({ status: 'approved' }, 2, 9);
  });

  it('replaces the URL with the new filter and resets the page when a filter changes', async () => {
    mockSearchParams.set('page', '3');
    vi.mocked(api.listTransactions).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 9, total: 0, totalPages: 1 },
    });
    const user = userEvent.setup();

    renderWithQueryClient(<Page />);
    await screen.findByText(/nenhuma transação encontrada/i);
    await user.selectOptions(screen.getByLabelText(/status/i), 'approved');

    expect(mockReplace).toHaveBeenCalledWith('/?status=approved');
  });

  it('replaces the URL with the new page, preserving filters, when pagination changes', async () => {
    mockSearchParams.set('status', 'pending');
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
      meta: { page: 1, pageSize: 9, total: 20, totalPages: 3 },
    });
    const user = userEvent.setup();

    renderWithQueryClient(<Page />);
    await user.click(await screen.findByRole('button', { name: /próxima/i }));

    expect(mockReplace).toHaveBeenCalledWith('/?status=pending&page=2');
  });
});
