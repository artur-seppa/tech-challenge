import { Inject, Injectable, Logger } from '@nestjs/common';
import { KafkaPublisherService } from '../shared/messaging/kafka-publisher.service';
import { TRANSACTION_REPOSITORY, type TransactionRepository } from './transaction.repository';

@Injectable()
export class RetryStaleTransactionsUseCase {
  private readonly logger = new Logger(RetryStaleTransactionsUseCase.name);

  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly repository: TransactionRepository,
    private readonly publisher: KafkaPublisherService,
  ) {}

  async execute(olderThan: Date, limit: number): Promise<number> {
    const stale = await this.repository.claimStalePending(olderThan, limit);

    for (const transaction of stale) {
      this.publisher.publish('transaction.created', {
        transactionExternalId: transaction.id,
        accountExternalIdDebit: transaction.accountExternalIdDebit,
        accountExternalIdCredit: transaction.accountExternalIdCredit,
        transferTypeId: transaction.transferTypeId,
        value: transaction.value,
        createdAt: transaction.createdAt.toISOString(),
      });
    }

    if (stale.length > 0) {
      this.logger.warn(
        `re-emitted transaction.created for ${stale.length} stale pending transaction(s)`,
      );
    }

    return stale.length;
  }
}
