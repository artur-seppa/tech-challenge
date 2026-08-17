import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListTransferTypesUseCase } from './list-transfer-types.use-case';
import type { TransferTypeRecord } from './transfer-type.repository';

const transferTypeResponseSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
    },
  },
};

@ApiTags('transfer-types')
@Controller('transfer-types')
export class TransferTypesController {
  constructor(private readonly listTransferTypes: ListTransferTypesUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Lista os tipos de transferência disponíveis' })
  @ApiResponse({
    status: 200,
    description: 'Tipos de transferência',
    schema: transferTypeResponseSchema,
  })
  list(): Promise<TransferTypeRecord[]> {
    return this.listTransferTypes.execute();
  }
}
