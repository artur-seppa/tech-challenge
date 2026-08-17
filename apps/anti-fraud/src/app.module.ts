import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EvaluateTransactionUseCase } from './evaluate-transaction.use-case';
import { DomainEventSerializer } from './shared/messaging/domain-event-serializer';
import { getKafkaClientOptions } from './shared/messaging/kafka-config';
import { KafkaPublisherService } from './shared/messaging/kafka-publisher.service';
import { TransactionCreatedConsumer } from './transaction-created.consumer';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    ClientsModule.register([
      {
        name: 'KAFKA_PRODUCER',
        transport: Transport.KAFKA,
        options: {
          client: getKafkaClientOptions(),
          serializer: new DomainEventSerializer(),
        },
      },
    ]),
  ],
  controllers: [TransactionCreatedConsumer],
  providers: [KafkaPublisherService, EvaluateTransactionUseCase],
})
export class AppModule {}
