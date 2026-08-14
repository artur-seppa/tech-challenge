import { PrismaService } from './prisma.service';
import { describe, expect, it, vi } from 'vitest';

describe('PrismaService', () => {
  it('connects to the database on module init', async () => {
    const service = new PrismaService();
    const connectSpy = vi.spyOn(service, '$connect').mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledOnce();
  });

  it('disconnects from the database on module destroy', async () => {
    const service = new PrismaService();
    const disconnectSpy = vi.spyOn(service, '$disconnect').mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalledOnce();
  });
});
