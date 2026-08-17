import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { TransactionEventsBroadcaster } from './transaction-events.broadcaster';
import { TransactionEventsController } from './transaction-events.controller';

describe('TransactionEventsController', () => {
  it('wraps each broadcaster event as an SSE MessageEvent', async () => {
    const broadcaster = new TransactionEventsBroadcaster();
    const controller = new TransactionEventsController(broadcaster);

    const received = firstValueFrom(controller.events());
    broadcaster.emit({
      transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      status: 'approved',
    });

    expect(await received).toEqual({
      data: { transactionExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', status: 'approved' },
    });
  });
});
