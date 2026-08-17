import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { MicroserviceOptions } from '@nestjs/microservices';
import { Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { getKafkaClientOptions } from './shared/messaging/kafka-config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.KAFKA,
    options: {
      client: getKafkaClientOptions(),
      consumer: {
        groupId: process.env.KAFKA_GROUP_ID_ANTI_FRAUD ?? 'anti-fraud-consumer',
      },
    },
  });

  await app.listen();
}

void bootstrap();
