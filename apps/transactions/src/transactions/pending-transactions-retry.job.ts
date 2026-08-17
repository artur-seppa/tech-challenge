import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { getPendingRetryConfig } from './pending-retry-config';
import { RetryStaleTransactionsUseCase } from './retry-stale-transactions.use-case';

const CHECK_INTERVAL_MS = 60_000;

@Injectable()
export class PendingTransactionsRetryJob {
  constructor(private readonly useCase: RetryStaleTransactionsUseCase) {}

  // Fixed on purpose, not read from env: an @Interval() argument is evaluated on import, before
  // ConfigModule.forRoot() (app.module.ts) loads the root .env, so reading env here would
  // silently ignore whatever .env says. thresholdMinutes/batchSize are read inside run(), after
  // bootstrap, so they don't have this problem.
  @Interval(CHECK_INTERVAL_MS)
  async run(): Promise<void> {
    const { thresholdMinutes, batchSize } = getPendingRetryConfig();
    const cutoff = new Date(Date.now() - thresholdMinutes * 60_000);

    await this.useCase.execute(cutoff, batchSize);
  }
}
