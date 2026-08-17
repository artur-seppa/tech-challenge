import { describe, expect, it } from 'vitest';
import { statusLabel } from '../../../src/lib/transactions/status-label';

describe('statusLabel', () => {
  it('translates pending to Pendente', () => {
    expect(statusLabel('pending')).toBe('Pendente');
  });

  it('translates approved to Aprovada', () => {
    expect(statusLabel('approved')).toBe('Aprovada');
  });

  it('translates rejected to Rejeitada', () => {
    expect(statusLabel('rejected')).toBe('Rejeitada');
  });
});
