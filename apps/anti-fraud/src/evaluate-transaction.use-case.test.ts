import { describe, expect, it } from 'vitest';
import { EvaluateTransactionUseCase } from './evaluate-transaction.use-case';

describe('EvaluateTransactionUseCase', () => {
  const useCase = new EvaluateTransactionUseCase();

  it('rejects a transaction with value above 1000', () => {
    expect(useCase.execute({ value: 1000.01 })).toBe('rejected');
  });

  it('approves a transaction with value exactly 1000', () => {
    expect(useCase.execute({ value: 1000 })).toBe('approved');
  });

  it('approves a transaction with value below 1000', () => {
    expect(useCase.execute({ value: 500 })).toBe('approved');
  });

  // Reprocessing safety (the pending-retry job, and duplicate Kafka delivery in general) relies
  // on this use case always returning the same result for the same input, documented in
  // DECISIONS.md "Retentativa de transações pendentes". This test exists so a future change
  // that makes the rule stateful (e.g. an external score, versioned rules) has to consciously
  // revisit that safety argument instead of silently invalidating it.
  it('is deterministic: the same value always produces the same result', () => {
    const results = Array.from({ length: 5 }, () => useCase.execute({ value: 1000.01 }));

    expect(new Set(results).size).toBe(1);
  });
});
