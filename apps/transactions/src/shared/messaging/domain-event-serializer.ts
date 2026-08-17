import type { Serializer } from '@nestjs/microservices';

/**
 * Registered as the Kafka client's `serializer`. NestJS's default KafkaRequestSerializer
 * treats any object with a "value" or "key" property as an already-built Kafka envelope,
 * silently dropping every other field, which mangled a transaction payload down to just its
 * `value`. Runs for every `emit()` on this client, so no call site can reintroduce that bug.
 */
export class DomainEventSerializer implements Serializer {
  serialize(value: unknown): { value: string } {
    return { value: JSON.stringify(value) };
  }
}
