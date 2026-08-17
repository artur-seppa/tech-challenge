import { describe, expect, it } from 'vitest';
import { DomainEventSerializer } from './domain-event-serializer';

describe('DomainEventSerializer', () => {
  it('wraps the payload as a raw Kafka message value, serialized', () => {
    const serializer = new DomainEventSerializer();

    const result = serializer.serialize({ transactionExternalId: 'id-1', status: 'approved' });

    expect(result).toEqual({
      value: JSON.stringify({ transactionExternalId: 'id-1', status: 'approved' }),
    });
  });

  it('does not lose fields when the payload has its own "value" property', () => {
    const serializer = new DomainEventSerializer();
    const payload = { transactionExternalId: 'id-1', value: 42 };

    const result = serializer.serialize(payload);

    expect(result).toEqual({ value: JSON.stringify(payload) });
  });
});
