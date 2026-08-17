import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { parseOrWarn, transactionCreatedEventSchema } from '@tech-challenge/contracts';
import { EvaluateTransactionUseCase } from './evaluate-transaction.use-case';
import { KafkaPublisherService } from './shared/messaging/kafka-publisher.service';

@Controller()
export class TransactionCreatedConsumer {
  private readonly logger = new Logger(TransactionCreatedConsumer.name);

  constructor(
    private readonly evaluateTransaction: EvaluateTransactionUseCase,
    private readonly publisher: KafkaPublisherService,
  ) {}

  @EventPattern('transaction.created')
  handle(@Payload() payload: unknown): void {
    const data = parseOrWarn(transactionCreatedEventSchema, payload, (reason) =>
      this.logger.warn(`ignoring malformed transaction.created payload: ${reason}`),
    );

    if (!data) return;

    const status = this.evaluateTransaction.execute({ value: data.value });

    this.publisher.publish('transaction.status.updated', {
      transactionExternalId: data.transactionExternalId,
      status,
    });
  }
}
