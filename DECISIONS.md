# Registro de Decisões

## Estrutura do monorepo

**Decisão:** monorepo único via pnpm workspaces (`apps/transactions`, `apps/anti-fraud`, `apps/web`,
`packages/contracts`, `packages/config`), sem Turborepo/Nx.

**Alternativas consideradas:** repositórios separados por serviço; Turborepo/Nx para orquestração de
build.

**Por quê:** os dois serviços de backend compartilham o contrato de evento Kafka — um monorepo permite
um pacote `contracts` único consumido por ambos, o que faz publisher e consumer nunca divergirem no
formato do payload (o compilador acusa a divergência, não a disciplina manual). Turborepo/Nx
agregariam cache de build distribuído, sem ganho perceptível no volume de código deste desafio.

## Validação de entrada e de eventos

**Decisão:** Zod para schemas de request HTTP e de payload de evento Kafka.

**Alternativas consideradas:** class-validator + class-transformer (decorators, padrão gerado pelo
Nest CLI).

**Por quê:** o mesmo schema Zod valida tanto o DTO HTTP quanto o payload do evento — sem duplicar
validação (decorators de um lado, parsing manual do outro). `z.infer` deriva o tipo TypeScript
diretamente do schema, então o tipo nunca diverge da validação.

## Camadas dentro dos módulos de negócio

**Decisão:** controller (fino) → use case → repositório (porta + implementação Prisma), com erros de
domínio e serializers próprios — não o padrão controller → service do Nest CLI.

**Alternativas consideradas:** um `Service` por módulo, como o `nest generate` produz por padrão.

**Por quê:** use cases dependem de uma interface de repositório, não da implementação Prisma —
testáveis com fakes/factories sem precisar de banco. Erros de domínio (`DomainError`) desacoplam a
regra de negócio do transporte HTTP: o mesmo use case pode futuramente ser chamado a partir de um
consumer Kafka, onde "HTTP 404" não faz sentido nenhum. Esta fundação já implementa o kernel
compartilhado (`DomainError`, `NotFoundError`, `ValidationError`, `DomainExceptionFilter`,
`ZodValidationPipe`, `toPaginatedResult`) em `apps/transactions/src/shared`; os módulos de negócio que
o consomem entram em specs futuras.

## Runner de testes

**Decisão:** Vitest em todo o monorepo — backend e frontend.

**Alternativas consideradas:** Jest, o runner que o `nest generate` configura por padrão.

**Por quê:** um único runner no monorepo inteiro, mais rápido que Jest e com watch mode melhor. Os
decorators do NestJS (`emitDecoratorMetadata`) funcionam via `unplugin-swc` no lugar do transform
padrão do Vitest, que não preserva metadata de decorator.

**Nota de implementação:** encontramos uma incompatibilidade real entre `@nestjs/testing`'s
`Test.createTestingModule()` e uma classe que estende `PrismaClient`, sob o pipeline SWC/Vite do
Vitest — a resolução de DI do Nest entra em recursão infinita nesse cenário específico (issue aberta
e não resolvida em `nestjs/nest`). `new PrismaService()` direto funciona normalmente; é só a
compilação via `TestingModule` que trava. Não afeta a aplicação real (que roda via `nest build`/`nest
start`, sem Vite/SWC no caminho de execução) — só o harness de teste. O teste de `PrismaService` foi
escrito testando o comportamento dos hooks de ciclo de vida diretamente (`$connect`/`$disconnect`
mockados), em vez de passar pelo compilador de DI do Nest.

## Plumbing de mensageria Kafka nesta fundação

**Decisão:** um tópico por tipo de evento (`transaction.created`, `transaction.status.updated`).
`transactions` roda como app híbrida (HTTP + Kafka); `anti-fraud` roda como microserviço Kafka puro,
sem servidor HTTP. Ambas publicam via `KafkaPublisherService`, testado com um `ClientKafka` mockado.
Nenhum handler `@EventPattern` é registrado ainda.

**Alternativas consideradas:** já decidir a política de falha (retry, dead-letter, idempotência) nesta
etapa.

**Por quê:** a política de falha depende do contexto de negócio de cada consumer — o que fazer com uma
transação cujo status não pôde ser atualizado é uma decisão diferente de como tratar uma mensagem
antifraude malformada. Decidir isso sem esse contexto seria decisão de fachada, não uma decisão
informada. Essa política entra no `DECISIONS.md` junto da implementação real de cada consumer.

## ORM

**Decisão:** Prisma 6.19.3, não a linha 7.x recém-lançada.

**Alternativas consideradas:** Prisma 7 (versão mais recente disponível no momento).

**Por quê:** o Prisma 7 torna obrigatório o uso de driver adapters, move a URL do banco do
`schema.prisma` para um novo `prisma.config.ts` e renomeia o generator — uma migração real, não uma
troca trivial de versão. Para uma fundação que precisa funcionar de forma previsível dentro do prazo
do desafio, a versão 6, madura e amplamente documentada, é a escolha mais segura.

## Versão do TypeScript

**Decisão:** TypeScript 6.0.3, não a linha 7.x recém-lançada.

**Alternativas consideradas:** TypeScript 7 (versão mais recente disponível no momento).

**Por quê:** `typescript-eslint@8.67.0` — a versão atual da ferramenta de lint — declara suporte a
`typescript >=4.8.4 <6.1.0`. A 6.0.3 é a última versão estável dentro dessa faixa; a 7.x quebraria o
lint tipado.
