import type { OnModuleInit } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { ClientKafka } from '@nestjs/microservices';
import type { Topic } from '@tech-challenge/contracts';

@Injectable()
export class KafkaPublisherService implements OnModuleInit {
  constructor(@Inject('KAFKA_PRODUCER') private readonly client: ClientKafka) {}

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  publish<TPayload extends object>(topic: Topic, payload: TPayload): void {
    this.client.emit(topic, payload);
  }
}
