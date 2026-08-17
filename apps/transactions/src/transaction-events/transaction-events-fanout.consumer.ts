import { randomUUID } from 'node:crypto';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import {
  parseOrWarn,
  TOPICS,
  transactionStatusUpdatedEventSchema,
} from '@tech-challenge/contracts';
import type { Consumer } from 'kafkajs';
import { getKafkaClient } from '../shared/messaging/kafka-config';
import { TransactionEventsBroadcaster } from './transaction-events.broadcaster';

@Injectable()
export class TransactionEventsFanoutConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransactionEventsFanoutConsumer.name);
  private consumer: Consumer | undefined;

  constructor(private readonly broadcaster: TransactionEventsBroadcaster) {}

  onModuleInit(): void {
    // Not awaited: this is an optional, best-effort feature (the frontend falls back to
    // polling if it never gets SSE data). Awaiting it here would make NestFactory.create()
    // itself hang whenever Kafka is briefly unreachable, taking the whole HTTP API (including
    // /health) down with it for a feature that has a working fallback.
    void this.startConsuming().catch((error: unknown) => {
      this.logger.error(`SSE fan-out consumer failed to start: ${String(error)}`);
    });
  }

  private async startConsuming(): Promise<void> {
    // Unique groupId per process, never reused across restarts: each instance stays alone in
    // its own consumer group, so Kafka delivers a copy of every event to every instance
    // (broadcast) instead of load-balancing across replicas like the persistence consumer does.
    this.consumer = getKafkaClient().consumer({ groupId: `sse-fanout-${randomUUID()}` });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: TOPICS.TRANSACTION_STATUS_UPDATED,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: ({ message }) => {
        this.handleMessage(message.value?.toString());
        return Promise.resolve();
      },
    });
  }

  handleMessage(raw: string | undefined): void {
    if (!raw) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn('ignoring malformed transaction.status.updated payload: invalid JSON');
      return;
    }

    const data = parseOrWarn(transactionStatusUpdatedEventSchema, parsed, (reason) =>
      this.logger.warn(`ignoring malformed transaction.status.updated payload: ${reason}`),
    );

    if (!data) return;

    this.broadcaster.emit(data);
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer?.disconnect();
  }
}
