import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getKafkaClient } from '../shared/messaging/kafka-config';
import { TransactionEventsFanoutConsumer } from './transaction-events-fanout.consumer';
import type { TransactionEventsBroadcaster } from './transaction-events.broadcaster';

vi.mock('../shared/messaging/kafka-config', () => ({
  getKafkaClient: vi.fn(),
}));

function makeBroadcasterMock(): TransactionEventsBroadcaster {
  return { emit: vi.fn() } as unknown as TransactionEventsBroadcaster;
}

afterEach(() => {
  vi.mocked(getKafkaClient).mockReset();
});

describe('TransactionEventsFanoutConsumer', () => {
  it('emits a valid payload to the broadcaster', () => {
    const broadcaster = makeBroadcasterMock();
    const consumer = new TransactionEventsFanoutConsumer(broadcaster);

    consumer.handleMessage(
      JSON.stringify({
        transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        status: 'approved',
      }),
    );

    expect(broadcaster.emit).toHaveBeenCalledWith({
      transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      status: 'approved',
    });
  });

  it('ignores a payload that fails schema validation', () => {
    const broadcaster = makeBroadcasterMock();
    const consumer = new TransactionEventsFanoutConsumer(broadcaster);

    consumer.handleMessage(JSON.stringify({ nope: true }));

    expect(broadcaster.emit).not.toHaveBeenCalled();
  });

  it('ignores invalid JSON instead of throwing', () => {
    const broadcaster = makeBroadcasterMock();
    const consumer = new TransactionEventsFanoutConsumer(broadcaster);

    expect(() => consumer.handleMessage('not json')).not.toThrow();
    expect(broadcaster.emit).not.toHaveBeenCalled();
  });

  it('ignores an undefined message value instead of throwing', () => {
    const broadcaster = makeBroadcasterMock();
    const consumer = new TransactionEventsFanoutConsumer(broadcaster);

    expect(() => consumer.handleMessage(undefined)).not.toThrow();
    expect(broadcaster.emit).not.toHaveBeenCalled();
  });

  it('does not wait for the Kafka connection before returning, so a slow/unreachable broker cannot block app bootstrap', () => {
    let resolveConnect: () => void = () => {};
    const connect = vi.fn(() => new Promise<void>((resolve) => (resolveConnect = resolve)));
    vi.mocked(getKafkaClient).mockReturnValue({
      consumer: () => ({ connect, subscribe: vi.fn(), run: vi.fn(), disconnect: vi.fn() }),
    } as unknown as ReturnType<typeof getKafkaClient>);

    const consumer = new TransactionEventsFanoutConsumer(makeBroadcasterMock());

    const result = consumer.onModuleInit();

    expect(result).toBeUndefined();
    expect(connect).toHaveBeenCalledOnce();
    resolveConnect();
  });

  it('logs, instead of throwing, when the Kafka connection fails', async () => {
    const error = new Error('broker unreachable');
    vi.mocked(getKafkaClient).mockReturnValue({
      consumer: () => ({ connect: vi.fn().mockRejectedValue(error) }),
    } as unknown as ReturnType<typeof getKafkaClient>);
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const consumer = new TransactionEventsFanoutConsumer(makeBroadcasterMock());
    consumer.onModuleInit();

    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(errorSpy.mock.calls[0]?.[0]).toContain('broker unreachable');
  });
});
