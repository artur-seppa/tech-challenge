import { Module } from '@nestjs/common';
import { ListTransferTypesUseCase } from './list-transfer-types.use-case';
import { TRANSFER_TYPE_REPOSITORY } from './transfer-type.repository';
import { PrismaTransferTypeRepository } from './transfer-type.repository.prisma';
import { TransferTypesController } from './transfer-types.controller';

@Module({
  controllers: [TransferTypesController],
  providers: [
    ListTransferTypesUseCase,
    { provide: TRANSFER_TYPE_REPOSITORY, useClass: PrismaTransferTypeRepository },
  ],
})
export class TransferTypesModule {}
