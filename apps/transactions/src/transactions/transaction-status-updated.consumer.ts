import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { parseOrWarn, transactionStatusUpdatedEventSchema } from '@tech-challenge/contracts';
import { UpdateTransactionStatusUseCase } from './update-transaction-status.use-case';

@Controller()
export class TransactionStatusUpdatedConsumer {
  private readonly logger = new Logger(TransactionStatusUpdatedConsumer.name);

  constructor(private readonly updateStatus: UpdateTransactionStatusUseCase) {}

  @EventPattern('transaction.status.updated')
  async handle(@Payload() payload: unknown): Promise<void> {
    const data = parseOrWarn(transactionStatusUpdatedEventSchema, payload, (reason) =>
      this.logger.warn(`ignoring malformed transaction.status.updated payload: ${reason}`),
    );

    if (!data) return;

    await this.updateStatus.execute(data);
  }
}
