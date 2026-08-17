import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionFilters } from '../../../src/components/transactions/transaction-filters';
import * as transferTypesApi from '../../../src/lib/transfer-types/api';
import { renderWithQueryClient } from '../../test-utils';

// Pinned to a non-UTC zone so the "De"/"Até" tests below actually catch a regression to
// UTC-midnight parsing. CI runners default to UTC, where local time equals UTC and the bug
// this guards against would be invisible.
process.env.TZ = 'America/Sao_Paulo';

vi.mock('../../../src/lib/transfer-types/api');

beforeEach(() => {
  vi.mocked(transferTypesApi.listTransferTypes).mockResolvedValue([
    { id: 1, name: 'Transferência entre contas' },
    { id: 2, name: 'Pagamento' },
  ]);
});

describe('TransactionFilters', () => {
  it('calls onChange with the selected status', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderWithQueryClient(<TransactionFilters filters={{}} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/status/i), 'approved');

    expect(onChange).toHaveBeenCalledWith({ status: 'approved' });
  });

  it('calls onChange with the id of the transfer type selected by name', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderWithQueryClient(<TransactionFilters filters={{}} onChange={onChange} />);

    await screen.findByRole('option', { name: 'Pagamento' });
    await user.selectOptions(screen.getByLabelText(/tipo/i), 'Pagamento');

    expect(onChange).toHaveBeenLastCalledWith({ transferTypeId: 2 });
  });

  it('lists "Todos" plus every transfer type fetched from the API', async () => {
    renderWithQueryClient(<TransactionFilters filters={{}} onChange={vi.fn()} />);

    const typeSelect = screen.getByLabelText(/tipo/i);
    expect(within(typeSelect).getByRole('option', { name: 'Todos' })).toBeInTheDocument();
    expect(
      await within(typeSelect).findByRole('option', { name: 'Transferência entre contas' }),
    ).toBeInTheDocument();
    expect(within(typeSelect).getByRole('option', { name: 'Pagamento' })).toBeInTheDocument();
  });

  it('sends "De" as local midnight of the selected date, not literal UTC midnight', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderWithQueryClient(<TransactionFilters filters={{}} onChange={onChange} />);

    await user.type(screen.getByLabelText(/^de$/i), '2026-08-17');

    const lastCall = onChange.mock.calls.at(-1) as [{ from: string }];
    const parsed = new Date(lastCall[0].from);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7);
    expect(parsed.getDate()).toBe(17);
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
    expect(parsed.getSeconds()).toBe(0);
  });

  it('sends "Até" as the last instant of local time of the selected date', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderWithQueryClient(<TransactionFilters filters={{}} onChange={onChange} />);

    await user.type(screen.getByLabelText(/^até$/i), '2026-08-17');

    const lastCall = onChange.mock.calls.at(-1) as [{ to: string }];
    const parsed = new Date(lastCall[0].to);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7);
    expect(parsed.getDate()).toBe(17);
    expect(parsed.getHours()).toBe(23);
    expect(parsed.getMinutes()).toBe(59);
    expect(parsed.getSeconds()).toBe(59);
  });
});
