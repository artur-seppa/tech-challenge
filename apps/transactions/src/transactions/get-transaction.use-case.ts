import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../shared/errors/not-found.error';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRecord,
  type TransactionRepository,
} from './transaction.repository';

@Injectable()
export class GetTransactionUseCase {
  constructor(@Inject(TRANSACTION_REPOSITORY) private readonly repository: TransactionRepository) {}

  async execute(externalId: string): Promise<TransactionRecord> {
    const transaction = await this.repository.findByExternalId(externalId);

    if (!transaction) {
      throw new NotFoundError(`transaction ${externalId} not found`);
    }

    return transaction;
  }
}
