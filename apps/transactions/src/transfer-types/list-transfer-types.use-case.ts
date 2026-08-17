import { Inject, Injectable } from '@nestjs/common';
import {
  TRANSFER_TYPE_REPOSITORY,
  type TransferTypeRecord,
  type TransferTypeRepository,
} from './transfer-type.repository';

@Injectable()
export class ListTransferTypesUseCase {
  constructor(
    @Inject(TRANSFER_TYPE_REPOSITORY) private readonly repository: TransferTypeRepository,
  ) {}

  execute(): Promise<TransferTypeRecord[]> {
    return this.repository.findAll();
  }
}
