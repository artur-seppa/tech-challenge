import { afterEach, describe, expect, it } from 'vitest';
import { getKafkaClientOptions } from './kafka-config';

const originalClientId = process.env.KAFKA_CLIENT_ID;
const originalBrokers = process.env.KAFKA_BROKERS;

afterEach(() => {
  process.env.KAFKA_CLIENT_ID = originalClientId;
  process.env.KAFKA_BROKERS = originalBrokers;
});

describe('getKafkaClientOptions', () => {
  it('falls back to the local dev defaults when no env vars are set', () => {
    delete process.env.KAFKA_CLIENT_ID;
    delete process.env.KAFKA_BROKERS;

    expect(getKafkaClientOptions()).toEqual({
      clientId: 'tech-challenge',
      brokers: ['localhost:9092'],
      retry: { retries: 1_000_000, maxRetryTime: 30_000 },
    });
  });

  it('reads clientId and a comma-separated broker list from the environment', () => {
    process.env.KAFKA_CLIENT_ID = 'my-service';
    process.env.KAFKA_BROKERS = 'broker-1:9092,broker-2:9092';

    expect(getKafkaClientOptions()).toEqual({
      clientId: 'my-service',
      brokers: ['broker-1:9092', 'broker-2:9092'],
      retry: { retries: 1_000_000, maxRetryTime: 30_000 },
    });
  });

  it('never gives up retrying a broker connection (a huge but finite retry budget, not literal Infinity)', () => {
    expect(Number.isFinite(getKafkaClientOptions().retry.retries)).toBe(true);
  });
});
