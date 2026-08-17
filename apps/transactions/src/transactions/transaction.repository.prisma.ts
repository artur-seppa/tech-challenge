import { Injectable } from '@nestjs/common';
import type { Transaction as PrismaTransaction, TransferType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../shared/database/prisma.service';
import { ValidationError } from '../shared/errors/validation.error';
import type {
  CreateTransactionInput,
  CreateTransactionResult,
  ListTransactionsParams,
  StalePendingTransaction,
  TransactionRecord,
  TransactionRepository,
  TransactionStatusValue,
} from './transaction.repository';

type PrismaTransactionWithType = PrismaTransaction & { transferType: TransferType };

function toRecord(transaction: PrismaTransactionWithType): TransactionRecord {
  return {
    id: transaction.id,
    accountExternalIdDebit: transaction.accountExternalIdDebit,
    accountExternalIdCredit: transaction.accountExternalIdCredit,
    transferTypeId: transaction.transferTypeId,
    transferTypeName: transaction.transferType.name,
    value: transaction.value.toNumber(),
    status: transaction.status,
    createdAt: transaction.createdAt,
  };
}

@Injectable()
export class PrismaTransactionRepository implements TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createIdempotent(input: CreateTransactionInput): Promise<CreateTransactionResult> {
    try {
      const transaction = await this.prisma.transaction.create({
        data: input,
        include: { transferType: true },
      });

      return { transaction: toRecord(transaction), wasCreated: true };
    } catch (error) {
      if (
        input.idempotencyKey !== undefined &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        (error.meta?.target as string[] | undefined)?.includes('idempotencyKey')
      ) {
        const existing = await this.prisma.transaction.findUniqueOrThrow({
          where: { idempotencyKey: input.idempotencyKey },
          include: { transferType: true },
        });

        return { transaction: toRecord(existing), wasCreated: false };
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ValidationError(`transferTypeId ${input.transferTypeId} não existe`);
      }

      throw error;
    }
  }

  async findByExternalId(externalId: string): Promise<TransactionRecord | null> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: externalId },
      include: { transferType: true },
    });

    return transaction ? toRecord(transaction) : null;
  }

  async findMany(
    params: ListTransactionsParams,
  ): Promise<{ data: TransactionRecord[]; total: number }> {
    const where: Prisma.TransactionWhereInput = {
      ...(params.filter.status !== undefined && { status: params.filter.status }),
      ...(params.filter.transferTypeId !== undefined && {
        transferTypeId: params.filter.transferTypeId,
      }),
      ...((params.filter.from !== undefined || params.filter.to !== undefined) && {
        createdAt: {
          ...(params.filter.from !== undefined && { gte: params.filter.from }),
          ...(params.filter.to !== undefined && { lte: params.filter.to }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { transferType: true },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data: data.map(toRecord), total };
  }

  async updateStatusByExternalId(
    externalId: string,
    status: TransactionStatusValue,
  ): Promise<TransactionRecord | null> {
    try {
      const transaction = await this.prisma.transaction.update({
        where: { id: externalId },
        data: { status },
        include: { transferType: true },
      });

      return toRecord(transaction);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }

      throw error;
    }
  }

  async claimStalePending(olderThan: Date, limit: number): Promise<StalePendingTransaction[]> {
    // Single statement: the claim and the updatedAt bump happen atomically, so two replicas
    // racing this query never come back with the same row. See DECISIONS.md "Retentativa de
    // transacoes pendentes".
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        accountExternalIdDebit: string;
        accountExternalIdCredit: string;
        transferTypeId: number;
        value: Prisma.Decimal;
        createdAt: Date;
      }>
    >(Prisma.sql`
      UPDATE transactions
      SET "updatedAt" = now()
      WHERE id IN (
        SELECT id FROM transactions
        WHERE status = 'pending' AND "updatedAt" < ${olderThan}
        ORDER BY "updatedAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, "accountExternalIdDebit", "accountExternalIdCredit", "transferTypeId", value, "createdAt"
    `);

    return rows.map((row) => ({
      id: row.id,
      accountExternalIdDebit: row.accountExternalIdDebit,
      accountExternalIdCredit: row.accountExternalIdCredit,
      transferTypeId: row.transferTypeId,
      value: Number(row.value),
      createdAt: row.createdAt,
    }));
  }
}
