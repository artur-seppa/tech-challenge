import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { MicroserviceOptions } from '@nestjs/microservices';
import { Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './shared/filters/domain-exception.filter';
import { getKafkaClientOptions } from './shared/messaging/kafka-config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Without this, OnModuleDestroy hooks never fire on SIGTERM/SIGINT: PrismaService never
  // disconnects and TransactionEventsFanoutConsumer never leaves its Kafka consumer group,
  // abandoning a `sse-fanout-<uuid>` group on the broker every restart.
  app.enableShutdownHooks();

  app.enableCors();
  app.useGlobalFilters(new DomainExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Transactions API')
    .setDescription(
      'Criação, consulta e listagem de transações financeiras. Ver `transaction.created` / `transaction.status.updated` no README para o fluxo assíncrono via Kafka.',
    )
    .setVersion('1.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: getKafkaClientOptions(),
      consumer: {
        groupId: process.env.KAFKA_GROUP_ID_TRANSACTIONS ?? 'transactions-consumer',
      },
    },
  });

  // Not awaited: HTTP request handling (transaction creation/listing, /health) only needs
  // Postgres, not this consumer, and awaiting it would hang app.listen() itself for as long as
  // Kafka is unreachable. getKafkaClientOptions()'s retry policy keeps it reconnecting
  // indefinitely instead of exhausting its retries and crashing the process.
  void app.startAllMicroservices().catch((error: unknown) => {
    new Logger('Bootstrap').error(`Kafka microservice failed to start: ${String(error)}`);
  });

  await app.listen(process.env.TRANSACTIONS_PORT ?? 3001);
}

void bootstrap();
