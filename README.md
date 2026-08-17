# Tech Challenge BIUD: Fullstack

Monorepo pnpm com dois serviços de backend (NestJS + Prisma + Kafka) e um dashboard (Next.js)
sobre uma API de transações financeiras validadas de forma assíncrona por um serviço antifraude.

- [O que foi construído](#o-que-foi-construído)
- [Stack](#stack)
- [Subindo o projeto](#subindo-o-projeto)
- [Rodando os serviços](#rodando-os-serviços)
- [Quality gate e testes](#quality-gate-e-testes)
- [Estrutura do repositório](#estrutura-do-repositório)
- [O que ficou de fora](#o-que-ficou-de-fora)
- [Decisões](#decisões)

## O que foi construído

**Backend**

- `POST /transactions`: cria a transação com status `pending` e publica `transaction.created` no
  Kafka. Aceita um header opcional `Idempotency-Key`: reenviar a mesma chave retorna a transação já
  criada em vez de duplicar. Ver
  [DECISIONS.md](./DECISIONS.md#idempotência-na-criação-de-transação).
- `GET /transactions/:id`: consulta uma transação pelo `transactionExternalId`.
- `GET /transactions`: listagem paginada, com filtros por `status`, `transferTypeId` e período
  (`from`/`to`).
- `anti-fraud` consome `transaction.created`, aplica a regra (valor acima de 1000 → `rejected`,
  senão `approved`) e publica `transaction.status.updated`.
- `transactions` consome `transaction.status.updated` e atualiza o status da transação no banco.
- `GET /transactions/notifications/events`: Server-Sent Events com fan-out multi-instância via
  Kafka (segundo consumer, `groupId` único por réplica), empurra a mudança de status pra tela sem
  polling.
- Job de retentativa (`apps/transactions`): varre transações `pending` presas há mais de
  `PENDING_RETRY_THRESHOLD_MINUTES` e reemite `transaction.created`. Cobre tanto falha na
  publicação original quanto falha/perda da resposta do `anti-fraud`. Ver
  [DECISIONS.md](./DECISIONS.md#retentativa-de-transações-pendentes).
- Modelagem de dados com Prisma (migration + seed), ver [DECISIONS.md](./DECISIONS.md).

**Frontend** (`apps/web`)

- Listagem paginada com filtros por status, tipo e período. Filtros e página vivem na query
  string, não em estado local: URL compartilhável/favoritável, e o botão voltar do navegador
  funciona pra filtro, não só pro drawer. Ver
  [DECISIONS.md](./DECISIONS.md#filtros-e-paginação-na-query-string-não-em-estado-local).
- Detalhe de uma transação.
- Criação de transação por formulário, validado com Zod. Cada tentativa de envio carrega uma
  chave de idempotência própria, reenviada em caso de retry e trocada só após sucesso.
- Estados de carregamento, erro e vazio nas telas principais.
- Status pendente atualiza via Server-Sent Events (`EventSource`, uma conexão por aba); se o SSE
  ficar indisponível (5 falhas de conexão seguidas), volta sozinho pro polling de 3s como
  fallback. Ver [DECISIONS.md](./DECISIONS.md#sse-com-fan-out-via-kafka--polling-como-fallback-degradado).
- E2E (Playwright) do fluxo de criação até a mudança assíncrona de status refletir na tela sem
  reload. Ver [Quality gate e testes](#quality-gate-e-testes).

**Fundação**

- Workspace pnpm, TypeScript estrito, lint + formatação com hook de pre-commit, validação de
  commit message (Conventional Commits), quality gate único (`pnpm quality`) e CI no GitHub
  Actions rodando esse mesmo gate a cada push/PR para `develop`.

## Stack

| Camada                 | Tecnologia                                  |
| ---------------------- | ------------------------------------------- |
| Runtime                | Node.js 22+                                 |
| Gerenciador de pacotes | pnpm                                        |
| Backend                | NestJS + TypeScript                         |
| ORM                    | Prisma                                      |
| Banco                  | PostgreSQL                                  |
| Mensageria             | Kafka                                       |
| Frontend               | Next.js + React + Tailwind + TanStack Query |
| Testes                 | Vitest + Testing Library + Playwright (E2E) |

## Subindo o projeto

```bash
cp .env.example .env
docker compose up -d          # Postgres, Kafka e Kafka UI
pnpm install                  # instala as dependências e gera o Prisma Client
pnpm --filter @tech-challenge/transactions exec prisma migrate deploy
pnpm --filter @tech-challenge/transactions exec prisma db seed
pnpm --filter @tech-challenge/web exec playwright install --with-deps chromium  # só p/ rodar o E2E
```

O `.env` na raiz é compartilhado pelos três apps: cada um carrega as variáveis de lá (não é
preciso duplicar `.env` por app). O passo do Playwright só é necessário pra rodar `pnpm quality`
ou os testes E2E do `web`; os demais comandos não precisam dele.

## Rodando os serviços

Em três terminais separados:

```bash
pnpm --filter @tech-challenge/transactions start:dev
pnpm --filter @tech-challenge/anti-fraud start:dev
pnpm --filter @tech-challenge/web dev
```

| Serviço                   | Endereço                   |
| ------------------------- | -------------------------- |
| API de transações         | http://localhost:3001      |
| Documentação (Swagger UI) | http://localhost:3001/docs |
| Dashboard                 | http://localhost:3000      |
| Kafka UI                  | http://localhost:8080      |

O antifraude (`anti-fraud`) não expõe HTTP: só consome/publica eventos Kafka, por isso não tem
Swagger.

## Quality gate e testes

```bash
pnpm quality   # build + lint + typecheck + format:check + test + E2E, no monorepo inteiro
```

Cada etapa também roda isolada (`pnpm lint`, `pnpm typecheck`, `pnpm test`, ...). O mesmo comando
roda no CI a cada push/PR para `develop`.

O E2E (`apps/web/e2e`, Playwright) sobe só o `next dev` do `web` e mocka as respostas da API
(`page.route`), não depende de Postgres/Kafka/backends reais no ar, por isso entra no
`pnpm quality`/CI sem precisar de infraestrutura extra. Cobre o fluxo de criar uma transação e
ver o status trocar de `Pendente` pra `Aprovada`/`Rejeitada` sozinho, via polling, sem reload.
Para rodar isolado: `pnpm --filter @tech-challenge/web test:e2e` (requer o `playwright install`
da seção anterior).

Estratégia de testes, cobertura e o que foi validado manualmente contra Postgres/Kafka reais estão
documentados no [DECISIONS.md](./DECISIONS.md#estratégia-de-testes).

## Estrutura do repositório

```
apps/
  transactions/   # API HTTP + consumer do retorno do antifraude
  anti-fraud/      # consumer + regra antifraude, sem HTTP nem banco
  web/             # dashboard Next.js
packages/
  contracts/       # schemas Zod dos eventos Kafka, compartilhados entre os dois backends
  config/          # eslint/prettier/tsconfig base, compartilhados por todo o workspace
```

Dentro de `apps/transactions/src/transactions`, o padrão é controller (fino) → use case →
repositório (porta + implementação Prisma), detalhado no DECISIONS.md.

## O que ficou de fora

- **Idempotência/retry/dead-letter para os consumers Kafka**: hoje uma mensagem malformada é
  logada e descartada (decisão registrada). Não há chave de idempotência para lidar com entrega
  duplicada (garantia _at-least-once_ do Kafka).
- **E2E contra infraestrutura real** (Postgres/Kafka/anti-fraud de verdade): o Playwright que
  existe hoje (`apps/web/e2e`) mocka a API pra validar o front de forma determinística e sem
  depender de infra no CI; o fluxo completo com Kafka real foi validado manualmente ponta a ponta
  durante o desenvolvimento, mas isso não está automatizado.
- **Read replica do Postgres** para leitura em alto volume, tirando a listagem/consulta de cima
  do mesmo banco que recebe as escritas. Não implementada; a resposta completa sobre concorrência
  está no DECISIONS.md.
- **Cache de busca no backend** (ex.: Redis na frente do `GET /transactions`): ficou fora do
  escopo e nenhum Redis foi instalado no `docker-compose` pra isso.
- Autenticação/autorização: não fazia parte do escopo do desafio.

## Decisões

Todas as decisões estruturantes (com alternativas consideradas e o porquê) estão em
[DECISIONS.md](./DECISIONS.md), incluindo dois bugs reais encontrados rodando a aplicação contra
infraestrutura real (não pegos pelos testes com mock): uma colisão de serialização no
`@nestjs/microservices` com o campo `value` do evento, e uma colisão do client gerado do Prisma
entre os dois serviços de backend.
