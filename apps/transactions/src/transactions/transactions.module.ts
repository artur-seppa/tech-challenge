import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CreateTransactionUseCase } from './create-transaction.use-case';
import { GetTransactionUseCase } from './get-transaction.use-case';
import { ListTransactionsUseCase } from './list-transactions.use-case';
import { PendingTransactionsRetryJob } from './pending-transactions-retry.job';
import { RetryStaleTransactionsUseCase } from './retry-stale-transactions.use-case';
import { TRANSACTION_REPOSITORY } from './transaction.repository';
import { PrismaTransactionRepository } from './transaction.repository.prisma';
import { TransactionStatusUpdatedConsumer } from './transaction-status-updated.consumer';
import { TransactionsController } from './transactions.controller';
import { UpdateTransactionStatusUseCase } from './update-transaction-status.use-case';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [TransactionsController, TransactionStatusUpdatedConsumer],
  providers: [
    CreateTransactionUseCase,
    GetTransactionUseCase,
    ListTransactionsUseCase,
    UpdateTransactionStatusUseCase,
    RetryStaleTransactionsUseCase,
    PendingTransactionsRetryJob,
    { provide: TRANSACTION_REPOSITORY, useClass: PrismaTransactionRepository },
  ],
})
export class TransactionsModule {}
