import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaPublisherService } from './shared/messaging/kafka-publisher.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClientsModule.register([
      {
        name: 'KAFKA_PRODUCER',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: process.env.KAFKA_CLIENT_ID ?? 'tech-challenge',
            brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
          },
        },
      },
    ]),
  ],
  providers: [KafkaPublisherService],
  exports: [KafkaPublisherService],
})
export class AppModule {}
