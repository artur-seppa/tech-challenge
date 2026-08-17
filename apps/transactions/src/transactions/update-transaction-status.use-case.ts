import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
  type TransactionStatusValue,
} from './transaction.repository';

export interface UpdateTransactionStatusInput {
  transactionExternalId: string;
  status: TransactionStatusValue;
}

@Injectable()
export class UpdateTransactionStatusUseCase {
  private readonly logger = new Logger(UpdateTransactionStatusUseCase.name);

  constructor(@Inject(TRANSACTION_REPOSITORY) private readonly repository: TransactionRepository) {}

  async execute(input: UpdateTransactionStatusInput): Promise<void> {
    const transaction = await this.repository.updateStatusByExternalId(
      input.transactionExternalId,
      input.status,
    );

    if (!transaction) {
      this.logger.warn(
        `transaction ${input.transactionExternalId} not found, ignoring status update`,
      );
    }
  }
}
