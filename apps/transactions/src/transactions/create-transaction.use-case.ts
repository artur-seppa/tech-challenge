import { Inject, Injectable } from '@nestjs/common';
import { KafkaPublisherService } from '../shared/messaging/kafka-publisher.service';
import {
  TRANSACTION_REPOSITORY,
  type CreateTransactionInput,
  type TransactionRecord,
  type TransactionRepository,
} from './transaction.repository';

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly repository: TransactionRepository,
    private readonly publisher: KafkaPublisherService,
  ) {}

  async execute(input: CreateTransactionInput): Promise<TransactionRecord> {
    const { transaction, wasCreated } = await this.repository.createIdempotent(input);

    // A replayed idempotency key must not re-trigger the antifraud flow; it was evaluated once.
    if (wasCreated) {
      this.publisher.publish('transaction.created', {
        transactionExternalId: transaction.id,
        accountExternalIdDebit: transaction.accountExternalIdDebit,
        accountExternalIdCredit: transaction.accountExternalIdCredit,
        transferTypeId: transaction.transferTypeId,
        value: transaction.value,
        createdAt: transaction.createdAt.toISOString(),
      });
    }

    return transaction;
  }
}
