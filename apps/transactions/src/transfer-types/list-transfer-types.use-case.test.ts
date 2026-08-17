import { describe, expect, it, vi } from 'vitest';
import { ListTransferTypesUseCase } from './list-transfer-types.use-case';
import type { TransferTypeRecord, TransferTypeRepository } from './transfer-type.repository';

function makeRepositoryMock(records: TransferTypeRecord[]): TransferTypeRepository {
  return { findAll: vi.fn().mockResolvedValue(records) };
}

describe('ListTransferTypesUseCase', () => {
  it('returns every transfer type from the repository', async () => {
    const records: TransferTypeRecord[] = [
      { id: 1, name: 'Transferência entre contas' },
      { id: 2, name: 'Pagamento' },
    ];
    const repository = makeRepositoryMock(records);
    const useCase = new ListTransferTypesUseCase(repository);

    const result = await useCase.execute();

    expect(repository.findAll).toHaveBeenCalled();
    expect(result).toBe(records);
  });
});
