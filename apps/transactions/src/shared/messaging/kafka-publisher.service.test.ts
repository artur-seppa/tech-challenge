import type { ClientKafka } from '@nestjs/microservices';
import { describe, expect, it, vi } from 'vitest';
import { KafkaPublisherService } from './kafka-publisher.service';

function makeClientKafkaMock(): ClientKafka {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    emit: vi.fn(),
  } as unknown as ClientKafka;
}

describe('KafkaPublisherService', () => {
  it('connects to the client on module init', async () => {
    const client = makeClientKafkaMock();
    const service = new KafkaPublisherService(client);

    await service.onModuleInit();

    expect(client.connect).toHaveBeenCalledOnce();
  });

  it('emits the payload on the given topic', () => {
    const client = makeClientKafkaMock();
    const service = new KafkaPublisherService(client);

    service.publish('transaction.created', { transactionExternalId: 'id-1' });

    expect(client.emit).toHaveBeenCalledWith('transaction.created', {
      transactionExternalId: 'id-1',
    });
  });
});
