import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Navbar } from '../../../src/components/layout/navbar';

const { mockSearchParams } = vi.hoisted(() => ({
  mockSearchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

beforeEach(() => {
  Array.from(mockSearchParams.keys()).forEach((key) => mockSearchParams.delete(key));
});

describe('Navbar', () => {
  it('renders the wordmark', () => {
    render(<Navbar />);

    expect(screen.getByText(/ledger/i)).toBeInTheDocument();
  });

  it('renders a link to open the create transaction drawer', () => {
    render(<Navbar />);

    const link = screen.getByRole('link', { name: /nova transação/i });
    expect(link).toHaveAttribute('href', '?new=1');
  });

  it('preserves existing filter/page query params and drops tx when opening the create drawer', () => {
    mockSearchParams.set('status', 'pending');
    mockSearchParams.set('tx', 'some-id');

    render(<Navbar />);

    const link = screen.getByRole('link', { name: /nova transação/i });
    expect(link).toHaveAttribute('href', '?status=pending&new=1');
  });
});
