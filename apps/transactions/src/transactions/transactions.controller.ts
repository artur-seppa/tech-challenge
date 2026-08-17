import { Body, Controller, Get, Headers, Param, Post, Query, UsePipes } from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { PaginatedResult } from '../shared/serialization/paginated-result';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateTransactionUseCase } from './create-transaction.use-case';
import {
  createTransactionSchema,
  MAX_TRANSACTION_VALUE,
  type CreateTransactionDto,
} from './dto/create-transaction.dto';
import {
  listTransactionsQuerySchema,
  type ListTransactionsQueryDto,
} from './dto/list-transactions.dto';
import { GetTransactionUseCase } from './get-transaction.use-case';
import { ListTransactionsUseCase } from './list-transactions.use-case';
import { serializeTransaction, type SerializedTransaction } from './transaction.serializer';
import type { ListTransactionsFilter } from './transaction.repository';

const createTransactionBodySchema = {
  type: 'object',
  required: ['accountExternalIdDebit', 'accountExternalIdCredit', 'transferTypeId', 'value'],
  properties: {
    accountExternalIdDebit: { type: 'string', format: 'uuid' },
    accountExternalIdCredit: { type: 'string', format: 'uuid' },
    transferTypeId: { type: 'integer', minimum: 1 },
    value: { type: 'number', minimum: 0, exclusiveMinimum: true, maximum: MAX_TRANSACTION_VALUE },
  },
};

const transactionResponseSchema = {
  type: 'object',
  properties: {
    transactionExternalId: { type: 'string', format: 'uuid' },
    transactionType: { type: 'object', properties: { name: { type: 'string' } } },
    transactionStatus: {
      type: 'object',
      properties: { name: { type: 'string', enum: ['pending', 'approved', 'rejected'] } },
    },
    value: { type: 'number' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const paginatedTransactionsResponseSchema = {
  type: 'object',
  properties: {
    data: { type: 'array', items: transactionResponseSchema },
    meta: {
      type: 'object',
      properties: {
        page: { type: 'integer' },
        pageSize: { type: 'integer' },
        total: { type: 'integer' },
        totalPages: { type: 'integer' },
      },
    },
  },
};

function buildFilter(query: ListTransactionsQueryDto): ListTransactionsFilter {
  return {
    ...(query.status !== undefined && { status: query.status }),
    ...(query.transferTypeId !== undefined && { transferTypeId: query.transferTypeId }),
    ...(query.from !== undefined && { from: new Date(query.from) }),
    ...(query.to !== undefined && { to: new Date(query.to) }),
  };
}

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransaction: CreateTransactionUseCase,
    private readonly getTransaction: GetTransactionUseCase,
    private readonly listTransactions: ListTransactionsUseCase,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createTransactionSchema))
  @ApiOperation({
    summary: 'Cria uma transação',
    description:
      'Grava a transação com status "pending" e publica o evento transaction.created. O status é atualizado de forma assíncrona quando o serviço antifraude responde.',
  })
  @ApiBody({ schema: createTransactionBodySchema })
  @ApiHeader({
    // Must match the string passed to @Headers() below, or this and the param that
    // @nestjs/swagger auto-generates from @Headers() show up as two contradictory entries.
    name: 'idempotency-key',
    required: false,
    description:
      'Chave opaca gerada pelo cliente por tentativa de envio. Reenviar a mesma chave (ex.: retry após timeout) retorna a transação já criada em vez de criar uma duplicata.',
  })
  @ApiResponse({ status: 201, description: 'Transação criada', schema: transactionResponseSchema })
  @ApiResponse({ status: 400, description: 'Dados inválidos (ver mensagem de erro do campo)' })
  async create(
    @Body() dto: CreateTransactionDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<SerializedTransaction> {
    const transaction = await this.createTransaction.execute({
      ...dto,
      ...(idempotencyKey !== undefined && { idempotencyKey }),
    });

    return serializeTransaction(transaction);
  }

  // A regex constraint here (`:id([0-9a-f-]{36})`) was tried to make route order irrelevant,
  // but path-to-regexp v8 (Express 5/Nest 11) dropped support for `:param(regex)` syntax and
  // the app crashed at boot (tsc/eslint/vitest all stayed green). Reverted. See DECISIONS.md.
  @Get(':id')
  @ApiOperation({ summary: 'Consulta uma transação pelo identificador externo' })
  @ApiParam({ name: 'id', description: 'transactionExternalId (uuid)', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Transação encontrada',
    schema: transactionResponseSchema,
  })
  @ApiResponse({ status: 404, description: 'Transação não encontrada' })
  async getById(@Param('id') id: string): Promise<SerializedTransaction> {
    const transaction = await this.getTransaction.execute(id);

    return serializeTransaction(transaction);
  }

  @Get()
  @UsePipes(new ZodValidationPipe(listTransactionsQuerySchema))
  @ApiOperation({ summary: 'Lista transações paginadas, com filtros por status, tipo e período' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected'] })
  @ApiQuery({ name: 'transferTypeId', required: false, type: Number })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'ISO 8601 datetime' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'ISO 8601 datetime' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Padrão: 1' })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Padrão: 20, máx.: 100',
  })
  @ApiResponse({
    status: 200,
    description: 'Página de transações',
    schema: paginatedTransactionsResponseSchema,
  })
  async list(
    @Query() query: ListTransactionsQueryDto,
  ): Promise<PaginatedResult<SerializedTransaction>> {
    const result = await this.listTransactions.execute({
      filter: buildFilter(query),
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      data: result.data.map(serializeTransaction),
      meta: result.meta,
    };
  }
}
