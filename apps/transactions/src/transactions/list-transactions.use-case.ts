import { Inject, Injectable } from '@nestjs/common';
import { toPaginatedResult, type PaginatedResult } from '../shared/serialization/paginated-result';
import {
  TRANSACTION_REPOSITORY,
  type ListTransactionsParams,
  type TransactionRecord,
  type TransactionRepository,
} from './transaction.repository';

@Injectable()
export class ListTransactionsUseCase {
  constructor(@Inject(TRANSACTION_REPOSITORY) private readonly repository: TransactionRepository) {}

  async execute(params: ListTransactionsParams): Promise<PaginatedResult<TransactionRecord>> {
    const { data, total } = await this.repository.findMany(params);

    return toPaginatedResult(data, { page: params.page, pageSize: params.pageSize, total });
  }
}
