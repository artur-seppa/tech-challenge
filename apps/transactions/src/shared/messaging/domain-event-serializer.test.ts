import { describe, expect, it } from 'vitest';
import { DomainEventSerializer } from './domain-event-serializer';

describe('DomainEventSerializer', () => {
  it('wraps the payload as a raw Kafka message value, serialized', () => {
    const serializer = new DomainEventSerializer();

    const result = serializer.serialize({ transactionExternalId: 'id-1' });

    expect(result).toEqual({ value: JSON.stringify({ transactionExternalId: 'id-1' }) });
  });

  it('does not lose fields when the payload has its own "value" property', () => {
    // This is exactly the collision the default KafkaRequestSerializer causes: it treats
    // any object with a "value" key as if it were already the raw envelope and keeps only
    // that key. Wrapping unconditionally sidesteps it regardless of the payload's shape.
    const serializer = new DomainEventSerializer();
    const payload = { transactionExternalId: 'id-1', value: 120.5 };

    const result = serializer.serialize(payload);

    expect(result).toEqual({ value: JSON.stringify(payload) });
  });
});
