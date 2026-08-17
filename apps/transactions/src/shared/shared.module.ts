import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PrismaService } from './database/prisma.service';
import { DomainEventSerializer } from './messaging/domain-event-serializer';
import { getKafkaClientOptions } from './messaging/kafka-config';
import { KafkaPublisherService } from './messaging/kafka-publisher.service';

@Global()
@Module({
  imports: [
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
  providers: [PrismaService, KafkaPublisherService],
  exports: [PrismaService, KafkaPublisherService],
})
export class SharedModule {}
