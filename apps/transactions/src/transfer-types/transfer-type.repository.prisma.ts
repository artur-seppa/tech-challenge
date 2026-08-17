import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import type { TransferTypeRecord, TransferTypeRepository } from './transfer-type.repository';

@Injectable()
export class PrismaTransferTypeRepository implements TransferTypeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<TransferTypeRecord[]> {
    return this.prisma.transferType.findMany({
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    });
  }
}
