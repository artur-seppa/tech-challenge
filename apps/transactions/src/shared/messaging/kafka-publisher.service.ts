import type { OnModuleInit } from '@nestjs/common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientKafka } from '@nestjs/microservices';
import type { Topic } from '@tech-challenge/contracts';
import { defer, retry, timer } from 'rxjs';

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

@Injectable()
export class KafkaPublisherService implements OnModuleInit {
  private readonly logger = new Logger(KafkaPublisherService.name);

  constructor(@Inject('KAFKA_PRODUCER') private readonly client: ClientKafka) {}

  onModuleInit(): void {
    // Not awaited: HTTP request handling doesn't need this producer connected, and awaiting it
    // would hang NestFactory.create() itself for as long as Kafka is unreachable. publish()'s
    // own retry/defer already tolerates the producer still connecting when it's first called.
    void this.client.connect().catch((error: unknown) => {
      this.logger.error(`Kafka producer failed to connect: ${String(error)}`);
    });
  }

  publish<TPayload extends object>(topic: Topic, payload: TPayload): void {
    // client.emit() connects and dispatches eagerly; its Observable is a one-shot multicast
    // that has already committed to a single attempt by the time anything subscribes, so
    // retrying it directly would just replay the same cached result. Wrapping in `defer` makes
    // each retry call emit() again from scratch, genuinely re-attempting the send.
    defer(() => this.client.emit(topic, payload))
      .pipe(
        retry({
          count: MAX_RETRIES,
          delay: (_error, attempt) => timer(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)),
        }),
      )
      .subscribe({
        error: (error: unknown) => {
          this.logger.error(
            `failed to publish to topic "${topic}" after ${MAX_RETRIES} retries: ${String(error)}`,
          );
        },
      });
  }
}
