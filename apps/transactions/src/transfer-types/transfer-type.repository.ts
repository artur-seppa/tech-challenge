export const TRANSFER_TYPE_REPOSITORY = 'TRANSFER_TYPE_REPOSITORY';

export interface TransferTypeRecord {
  id: number;
  name: string;
}

export interface TransferTypeRepository {
  findAll(): Promise<TransferTypeRecord[]>;
}
