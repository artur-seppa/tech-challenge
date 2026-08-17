import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateTransactionForm } from '../../../src/components/transactions/create-transaction-form';
import * as api from '../../../src/lib/transactions/api';
import * as transferTypesApi from '../../../src/lib/transfer-types/api';
import { renderWithQueryClient } from '../../test-utils';

vi.mock('../../../src/lib/transactions/api');
vi.mock('../../../src/lib/transfer-types/api');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const validInput = {
  accountExternalIdDebit: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
  accountExternalIdCredit: '3fa85f64-5717-4562-b3fc-2c963f66afa8',
  transferTypeId: '1',
  value: '120',
};

beforeEach(() => {
  // Without this, api.createTransaction's mock.calls accumulates across tests in this file
  // (vitest doesn't clear mocks by default), and the idempotency-key tests below need each
  // test's calls to start from zero to compare keys reliably.
  vi.clearAllMocks();
  vi.mocked(transferTypesApi.listTransferTypes).mockResolvedValue([
    { id: 1, name: 'Pagamento' },
    { id: 2, name: 'Saque' },
  ]);
});

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/conta de débito/i), validInput.accountExternalIdDebit);
  await user.type(screen.getByLabelText(/conta de crédito/i), validInput.accountExternalIdCredit);
  await user.selectOptions(await screen.findByLabelText(/tipo de transferência/i), 'Pagamento');
  await user.type(screen.getByLabelText(/valor/i), validInput.value);
}

describe('CreateTransactionForm', () => {
  it('shows a validation error and does not submit when a required field is invalid', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<CreateTransactionForm />);

    await user.type(screen.getByLabelText(/conta de débito/i), 'not-a-uuid');
    await user.click(screen.getByRole('button', { name: /criar transação/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/dados inválidos/i);
    expect(api.createTransaction).not.toHaveBeenCalled();
  });

  it('shows a field-level hint explaining the GUID format when an account id is invalid', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<CreateTransactionForm />);

    await user.type(screen.getByLabelText(/conta de débito/i), 'not-a-uuid');
    await user.type(screen.getByLabelText(/conta de crédito/i), validInput.accountExternalIdCredit);
    await user.selectOptions(await screen.findByLabelText(/tipo de transferência/i), 'Pagamento');
    await user.type(screen.getByLabelText(/valor/i), validInput.value);
    await user.click(screen.getByRole('button', { name: /criar transação/i }));

    const debitInput = await screen.findByLabelText(/conta de débito/i);
    expect(debitInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/informe um guid válido/i)).toBeInTheDocument();
    expect(api.createTransaction).not.toHaveBeenCalled();
  });

  it('lists the transfer types fetched from the API as select options', async () => {
    renderWithQueryClient(<CreateTransactionForm />);

    const select = await screen.findByLabelText(/tipo de transferência/i);
    expect(await screen.findByRole('option', { name: 'Pagamento' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Saque' })).toBeInTheDocument();
    expect(select).toBeInTheDocument();
  });

  it('submits the transaction when the form is valid', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createTransaction).mockResolvedValue({
      transactionExternalId: 'new-id',
      transactionType: { name: 'Pagamento' },
      transactionStatus: { name: 'pending' },
      value: 120,
      createdAt: '2026-08-14T10:00:00.000Z',
    });

    renderWithQueryClient(<CreateTransactionForm />);
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /criar transação/i }));

    expect(await screen.findByText(/transação criada/i)).toBeInTheDocument();
    expect(vi.mocked(api.createTransaction).mock.calls[0]?.[0]).toEqual({
      accountExternalIdDebit: validInput.accountExternalIdDebit,
      accountExternalIdCredit: validInput.accountExternalIdCredit,
      transferTypeId: 1,
      value: 120,
    });
    expect(vi.mocked(api.createTransaction).mock.calls[0]?.[1]).toEqual(expect.any(String));
  });

  it('shows an error state when submission fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createTransaction).mockRejectedValue(new Error('boom'));

    renderWithQueryClient(<CreateTransactionForm />);
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /criar transação/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível criar/i);
  });

  it('reuses the same idempotency key when retrying after a failed submission', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createTransaction).mockRejectedValue(new Error('boom'));

    renderWithQueryClient(<CreateTransactionForm />);
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /criar transação/i }));
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: /criar transação/i }));
    await screen.findByRole('alert');

    const calls = vi.mocked(api.createTransaction).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[1]).toBe(calls[1]?.[1]);
  });

  it('clears the form and uses a fresh idempotency key for the next submission after success', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createTransaction).mockResolvedValue({
      transactionExternalId: 'new-id',
      transactionType: { name: 'Pagamento' },
      transactionStatus: { name: 'pending' },
      value: 120,
      createdAt: '2026-08-14T10:00:00.000Z',
    });

    renderWithQueryClient(<CreateTransactionForm />);
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /criar transação/i }));
    await screen.findByText(/transação criada/i);

    expect(screen.getByLabelText(/conta de débito/i)).toHaveValue('');
    expect(screen.getByLabelText(/valor/i)).toHaveValue(null);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /criar transação/i }));
    await waitFor(() => expect(api.createTransaction).toHaveBeenCalledTimes(2));

    const calls = vi.mocked(api.createTransaction).mock.calls;
    expect(calls[1]?.[1]).not.toBe(calls[0]?.[1]);
  });
});
