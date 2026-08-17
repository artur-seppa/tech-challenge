import { describe, expect, it } from 'vitest';
import { TransactionEventsBroadcaster } from './transaction-events.broadcaster';

describe('TransactionEventsBroadcaster', () => {
  it('delivers an emitted event to a subscriber', () => {
    const broadcaster = new TransactionEventsBroadcaster();
    const received: unknown[] = [];
    broadcaster.stream().subscribe((event) => received.push(event));

    broadcaster.emit({
      transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      status: 'approved',
    });

    expect(received).toEqual([
      { transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', status: 'approved' },
    ]);
  });

  it('delivers the same event to multiple subscribers', () => {
    const broadcaster = new TransactionEventsBroadcaster();
    const a: unknown[] = [];
    const b: unknown[] = [];
    broadcaster.stream().subscribe((event) => a.push(event));
    broadcaster.stream().subscribe((event) => b.push(event));

    broadcaster.emit({
      transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      status: 'rejected',
    });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });
});
