import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TRANSFER_TYPES = ['Transferência entre contas', 'Pagamento', 'Saque'];

async function main(): Promise<void> {
  for (const name of TRANSFER_TYPES) {
    await prisma.transferType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
