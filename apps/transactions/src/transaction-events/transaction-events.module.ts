import { Module } from '@nestjs/common';
import { TransactionEventsFanoutConsumer } from './transaction-events-fanout.consumer';
import { TransactionEventsBroadcaster } from './transaction-events.broadcaster';
import { TransactionEventsController } from './transaction-events.controller';

@Module({
  controllers: [TransactionEventsController],
  providers: [TransactionEventsBroadcaster, TransactionEventsFanoutConsumer],
})
export class TransactionEventsModule {}
