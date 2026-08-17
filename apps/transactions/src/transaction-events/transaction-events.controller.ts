import type { MessageEvent } from '@nestjs/common';
import { Controller, Sse } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { map, type Observable } from 'rxjs';
import { TransactionEventsBroadcaster } from './transaction-events.broadcaster';

@ApiTags('transaction-events')
@Controller('transactions')
export class TransactionEventsController {
  constructor(private readonly broadcaster: TransactionEventsBroadcaster) {}

  // Two path segments ("notifications/events"), not one: TransactionsController's `:id` route
  // only matches a single segment, so this route structurally can't collide with it. See
  // DECISIONS.md for the single-segment version that did collide. "notifications", not "sse":
  // the URL names what the client gets, not the transport mechanism delivering it.
  @Sse('notifications/events')
  @ApiOperation({
    summary: 'Stream de atualizações de status de transação (Server-Sent Events)',
    description:
      'Cada mensagem traz { transactionExternalId, status }. Broadcast global, uma conexão por aba.',
  })
  events(): Observable<MessageEvent> {
    return this.broadcaster.stream().pipe(map((event) => ({ data: event })));
  }
}
