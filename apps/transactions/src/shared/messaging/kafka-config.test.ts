import { afterEach, describe, expect, it } from 'vitest';
import { getKafkaClient, getKafkaClientOptions } from './kafka-config';

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
    // Literal Infinity isn't safe here: kafkajs computes a numeric backoff from the retry
    // count, and Infinity would propagate into that arithmetic. A very large finite count
    // paired with a capped maxRetryTime behaves the same in practice (retries roughly every
    // 30s, indefinitely) without ever handing kafkajs a non-finite number.
    expect(Number.isFinite(getKafkaClientOptions().retry.retries)).toBe(true);
  });
});

describe('getKafkaClient', () => {
  it('returns the same client instance on every call', () => {
    expect(getKafkaClient()).toBe(getKafkaClient());
  });
});
