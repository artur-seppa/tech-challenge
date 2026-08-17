import { Logger } from '@nestjs/common';
import type { ClientKafka } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KafkaPublisherService } from './kafka-publisher.service';

function makeClientKafkaMock(): ClientKafka {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    emit: vi.fn().mockReturnValue(of(undefined)),
  } as unknown as ClientKafka;
}

describe('KafkaPublisherService', () => {
  it('connects to the client on module init', async () => {
    const client = makeClientKafkaMock();
    const service = new KafkaPublisherService(client);

    await service.onModuleInit();

    expect(client.connect).toHaveBeenCalledOnce();
  });

  it('passes the raw payload straight through to emit()', () => {
    // Envelope-wrapping is DomainEventSerializer's job now (see domain-event-serializer.test.ts),
    // registered as this client's `serializer`. publish() just passes the payload through.
    const client = makeClientKafkaMock();
    const service = new KafkaPublisherService(client);
    const payload = { transactionExternalId: 'id-1', value: 42 };

    service.publish('transaction.status.updated', payload);

    expect(client.emit).toHaveBeenCalledWith('transaction.status.updated', payload);
  });

  describe('retry on failure', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('retries a failed publish with exponential backoff, then logs an error once retries are exhausted', async () => {
      const client = {
        connect: vi.fn().mockResolvedValue(undefined),
        emit: vi.fn().mockReturnValue(throwError(() => new Error('broker unreachable'))),
      } as unknown as ClientKafka;
      const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const service = new KafkaPublisherService(client);

      service.publish('transaction.status.updated', { transactionExternalId: 'id-1' });

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      expect(client.emit).toHaveBeenCalledTimes(4);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('failed to publish to topic "transaction.status.updated"'),
      );
    });

    it('recovers after a transient failure without logging an error', async () => {
      const client = {
        connect: vi.fn().mockResolvedValue(undefined),
        emit: vi
          .fn()
          .mockReturnValueOnce(throwError(() => new Error('broker unreachable')))
          .mockReturnValue(of(undefined)),
      } as unknown as ClientKafka;
      const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const service = new KafkaPublisherService(client);

      service.publish('transaction.status.updated', { transactionExternalId: 'id-1' });

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(500);

      expect(client.emit).toHaveBeenCalledTimes(2);
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
