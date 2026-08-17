import { Injectable } from '@nestjs/common';
import type { TransactionStatusUpdatedEvent } from '@tech-challenge/contracts';

const FRAUD_THRESHOLD = 1000;

@Injectable()
export class EvaluateTransactionUseCase {
  execute(transaction: { value: number }): TransactionStatusUpdatedEvent['status'] {
    return transaction.value > FRAUD_THRESHOLD ? 'rejected' : 'approved';
  }
}
