export interface KafkaClientOptions {
  clientId: string;
  brokers: string[];
  retry: { retries: number; maxRetryTime: number };
}

// kafkajs's own default (5 retries, capped backoff) gives up and throws after ~8.5s if a
// broker is unreachable, and that throw is an uncaught rejection that kills the whole process
// (confirmed by actually pointing a broker at an unreachable address and watching it crash).
// A much larger retry budget with the same capped backoff means it keeps trying roughly every
// 30s indefinitely instead of ever giving up.
const RETRY_POLICY = { retries: 1_000_000, maxRetryTime: 30_000 };

export function getKafkaClientOptions(): KafkaClientOptions {
  return {
    clientId: process.env.KAFKA_CLIENT_ID ?? 'tech-challenge',
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    retry: RETRY_POLICY,
  };
}
