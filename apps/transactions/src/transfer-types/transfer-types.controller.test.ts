import { describe, expect, it, vi } from 'vitest';
import type { ListTransferTypesUseCase } from './list-transfer-types.use-case';
import type { TransferTypeRecord } from './transfer-type.repository';
import { TransferTypesController } from './transfer-types.controller';

describe('TransferTypesController', () => {
  it('returns the transfer types from the use case', async () => {
    const records: TransferTypeRecord[] = [{ id: 1, name: 'Pagamento' }];
    const listTransferTypes = {
      execute: vi.fn().mockResolvedValue(records),
    } as unknown as ListTransferTypesUseCase;
    const controller = new TransferTypesController(listTransferTypes);

    const result = await controller.list();

    expect(listTransferTypes.execute).toHaveBeenCalled();
    expect(result).toBe(records);
  });
});
