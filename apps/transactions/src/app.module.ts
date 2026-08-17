import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { SharedModule } from './shared/shared.module';
import { TransactionEventsModule } from './transaction-events/transaction-events.module';
import { TransactionsModule } from './transactions/transactions.module';
import { TransferTypesModule } from './transfer-types/transfer-types.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    SharedModule,
    TransactionEventsModule,
    TransactionsModule,
    TransferTypesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
