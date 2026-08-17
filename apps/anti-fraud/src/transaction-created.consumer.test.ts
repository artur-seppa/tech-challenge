import { describe, expect, it, vi } from 'vitest';
import { makeTransactionCreatedEvent } from '../test/factories/transaction-created-event.factory';
import { EvaluateTransactionUseCase } from './evaluate-transaction.use-case';
import type { KafkaPublisherService } from './shared/messaging/kafka-publisher.service';
import { TransactionCreatedConsumer } from './transaction-created.consumer';

function makePublisherMock(): KafkaPublisherService {
  return { publish: vi.fn() } as unknown as KafkaPublisherService;
}

describe('TransactionCreatedConsumer', () => {
  it('publishes an approved status.updated event for a transaction at or below the threshold', () => {
    const publisher = makePublisherMock();
    const consumer = new TransactionCreatedConsumer(new EvaluateTransactionUseCase(), publisher);
    const event = makeTransactionCreatedEvent({ value: 1000 });

    consumer.handle(event);

    expect(publisher.publish).toHaveBeenCalledWith('transaction.status.updated', {
      transactionExternalId: event.transactionExternalId,
      status: 'approved',
    });
  });

  it('publishes a rejected status.updated event for a transaction above the threshold', () => {
    const publisher = makePublisherMock();
    const consumer = new TransactionCreatedConsumer(new EvaluateTransactionUseCase(), publisher);
    const event = makeTransactionCreatedEvent({ value: 1000.01 });

    consumer.handle(event);

    expect(publisher.publish).toHaveBeenCalledWith('transaction.status.updated', {
      transactionExternalId: event.transactionExternalId,
      status: 'rejected',
    });
  });

  it('ignores a malformed payload instead of throwing', () => {
    const publisher = makePublisherMock();
    const consumer = new TransactionCreatedConsumer(new EvaluateTransactionUseCase(), publisher);

    expect(() => consumer.handle({ nope: true })).not.toThrow();
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});
