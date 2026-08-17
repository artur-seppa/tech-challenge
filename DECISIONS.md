# Registro de Decisões

## Estrutura do monorepo

**Decisão:** monorepo via pnpm workspaces (`apps/transactions`, `apps/anti-fraud`, `apps/web`,
`packages/contracts`, `packages/config`), sem Turborepo/Nx.

**Alternativas consideradas:** repositórios separados por serviço; Turborepo/Nx para orquestração
de build.

**Por quê:** os dois backends compartilham o contrato de evento Kafka. Um monorepo permite um
pacote `contracts` único consumido pelos dois, então publisher e consumer nunca divergem no
formato do payload (o compilador acusa a divergência, não a disciplina manual). Turborepo/Nx
agregariam cache de build distribuído, sem ganho perceptível no volume de código deste desafio.

## Validação de entrada e de eventos

**Decisão:** Zod para schemas de request HTTP e de payload de evento Kafka.

**Alternativas consideradas:** class-validator + class-transformer (decorators, padrão do Nest CLI).

**Por quê:** o mesmo schema Zod valida DTO HTTP e payload de evento, sem duplicar validação.
`z.infer` deriva o tipo TypeScript direto do schema, então o tipo nunca diverge da validação.

## Formato dos eventos Kafka

**Decisão:** `transaction.created` (`packages/contracts`) carrega um snapshot completo da
transação: `transactionExternalId`, `accountExternalIdDebit`, `accountExternalIdCredit`,
`transferTypeId`, `value`, `createdAt`. `transaction.status.updated` carrega só o delta:
`transactionExternalId` e `status`. Os dois reaproveitam o nome `transactionExternalId` do
contrato HTTP como identificador, em vez de um nome próprio de evento.

**Alternativas consideradas:** `transaction.created` carregando só o `transactionExternalId`,
com o `anti-fraud` buscando o resto via chamada de volta ao serviço `transactions`;
`transaction.status.updated` carregando o snapshot completo da transação, não só o delta.

**Por quê:** o enunciado deixa o formato do payload livre, mas exige comunicação assíncrona via
Kafka entre os dois serviços, sem a chamada de criação esperar o resultado da validação. Um
evento com só o id forçaria o `anti-fraud` a fazer uma chamada HTTP de volta pra buscar os dados,
reintroduzindo acoplamento síncrono entre os serviços exatamente onde o desenho pede
desacoplamento, e o `anti-fraud` não tem endpoint nenhum pra ser chamado (é consumer Kafka puro,
sem HTTP, decisão registrada em "Remoção do Prisma do anti-fraud"). Levar o snapshot completo no
evento de criação mantém o `anti-fraud` autossuficiente: avalia a regra só com o que chegou na
mensagem. Já `transaction.status.updated` não precisa devolver a transação inteira, porque
`transactions` já tem o registro completo e autoritativo; devolver mais que `status` seria
redundante e abriria espaço pro `anti-fraud` (que não é dono do dado) escrever campos que não
deveria. Reaproveitar `transactionExternalId` como nome de campo, igual ao contrato HTTP, evita um
segundo vocabulário pro mesmo identificador entre HTTP e Kafka.

## Camadas dentro dos módulos de negócio: Clean Architecture

**Decisão:** Clean Architecture nos módulos de negócio do backend: controller (fino, camada de
transporte) → use case (regra de negócio) → repositório (porta + implementação Prisma, camada de
infraestrutura), com erros de domínio e serializers próprios, não o padrão controller → service do
Nest CLI.

**Alternativas consideradas:** um `Service` por módulo, como o `nest generate` produz por padrão.

**Por quê:** a dependência aponta pra dentro (o use case depende de uma interface de repositório,
não da implementação Prisma), o princípio central de Clean Architecture: a regra de negócio não
conhece o banco nem o transporte HTTP, então é testável com fakes, sem precisar de banco. Erros de
domínio (`DomainError`) desacoplam a regra de negócio do transporte HTTP, útil se um use case
futuramente for chamado a partir de um consumer Kafka, onde "HTTP 404" não faz sentido.

## Tipo de transferência: endpoint de leitura + select no formulário

**Decisão:** `GET /transfer-types` segue a mesma camada `controller → use case → repositório` do
módulo `transactions`, mesmo sem regra de negócio pra isolar. No front, os dois lugares que usam
`transferTypeId` (formulário e filtro) trocaram `<input type="number">` por `<select>` com o nome
do tipo, alimentado por um único `useTransferTypes()` (`staleTime: Infinity`).

**Alternativas consideradas:** controller fino direto no Prisma, sem use case/repositório.

**Por quê:** consistência com o resto do backend pesou mais que YAGNI aqui. No front, pedir um id
numérico decorado (`transferTypeId: 1`) não dá pro usuário adivinhar o que cada número significa;
foi o que gerou o bug relatado antes deste registro (usuário não conseguia criar transação por não
saber o formato esperado dos campos).

## Runner de testes

**Decisão:** Vitest em todo o monorepo.

**Alternativas consideradas:** Jest, o runner padrão do `nest generate`.

**Por quê:** um único runner no monorepo inteiro, mais rápido que Jest, watch mode melhor. Os
decorators do NestJS (`emitDecoratorMetadata`) funcionam via `unplugin-swc` no lugar do transform
padrão do Vitest, que não preserva metadata de decorator.

**Nota de implementação:** existe uma incompatibilidade real entre `@nestjs/testing`'s
`Test.createTestingModule()` e uma classe que estende `PrismaClient` sob o pipeline SWC/Vite do
Vitest (a resolução de DI do Nest entra em recursão infinita nesse cenário; issue aberta e não
resolvida em `nestjs/nest`). `new PrismaService()` direto funciona; só a compilação via
`TestingModule` trava. Não afeta a aplicação real (`nest build`/`nest start`, sem Vite/SWC no
caminho de execução), só o harness de teste. O teste de `PrismaService` testa os hooks de ciclo de
vida diretamente (`$connect`/`$disconnect` mockados), sem passar pelo compilador de DI do Nest.

## Plumbing de mensageria Kafka nesta fundação

**Decisão:** um tópico por tipo de evento (`transaction.created`, `transaction.status.updated`).
`transactions` roda como app híbrida (HTTP + Kafka); `anti-fraud` roda como microserviço Kafka
puro, sem servidor HTTP. Ambas publicam via `KafkaPublisherService`, testado com `ClientKafka`
mockado.

**Alternativas consideradas:** já decidir a política de falha (retry, dead-letter, idempotência)
nesta etapa.

**Por quê:** a política de falha depende do contexto de negócio de cada consumer. O que fazer com
uma transação cujo status não pôde ser atualizado é diferente de como tratar uma mensagem
antifraude malformada. Decidir sem esse contexto seria decisão de fachada. Essa política entra no
`DECISIONS.md` junto da implementação real de cada consumer.

## Retentativa de transações pendentes

**Decisão:** um job em `apps/transactions` (`PendingTransactionsRetryJob`, `@Interval` do
`@nestjs/schedule`) varre a cada 1 minuto (fixo) transações `pending` cujo `updatedAt` é mais
antigo que `PENDING_RETRY_THRESHOLD_MINUTES` (`.env`, default 10min) e reemite `transaction.created`
para cada uma. Cobre os dois pontos de falha do fluxo assíncrono: publicação original perdida
(mesmo após o backoff, ver "Falha na publicação Kafka") ou resposta do `anti-fraud` perdida. Em
ambos os casos a transação fica presa em `pending`, e reemitir resolve os dois, já que nem
`anti-fraud` nem o consumer de status guardam "já vi esse id" (reprocessar é seguro, ver abaixo).

O claim é uma query SQL bruta (`transaction.repository.prisma.ts`, `claimStalePending`):
`UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED LIMIT PENDING_RETRY_BATCH_SIZE)
RETURNING ...`. Reivindica as linhas (`updatedAt = now()`, sem mexer no `status`) e já devolve os
dados pra reemitir, tudo atômico. `FOR UPDATE SKIP LOCKED` cobre múltiplas réplicas rodando o
mesmo `@Interval` ao mesmo tempo: cada réplica pula as linhas que outra já está segurando, então a
mesma transação nunca é reivindicada duas vezes na mesma janela. O touch do `updatedAt` acontece
antes do publish no Kafka; se o publish falhar mesmo após o backoff, o pior caso é a linha esperar
mais um ciclo, nunca reemissão dobrada.

**Por que reemitir é seguro:** `EvaluateTransactionUseCase` é pura e determinística
(`value > 1000`), sem side effect; `UpdateTransactionStatusUseCase` faz um `UPDATE` incondicional
pro status recebido. Duas avaliações da mesma transação sempre chegam no mesmo resultado, e
aplicar o mesmo status duas vezes é inofensivo. Nenhuma tabela de idempotência/dedupe foi criada: o
pipeline já é idempotente por construção.

**Alternativas consideradas:** coluna `lastRetriedAt` em vez de reaproveitar `updatedAt` (redundante);
`@Interval` lendo o intervalo do `.env` (descartado: o argumento do decorator é avaliado na
importação do arquivo, antes do `ConfigModule.forRoot()` carregar o `.env` em `app.module.ts`, então
um valor customizado seria silenciosamente ignorado; só `thresholdMinutes`/`batchSize`, lidos
dentro de `run()` após o bootstrap, são configuráveis por env).

**Índice adicional:** `@@index([status, updatedAt])` em `Transaction` (migration
`pending_retry_index`), pra a query do claim não depender de scan sequencial sob volume alto.

Verificado contra Postgres/Kafka reais: com o `anti-fraud` parado, uma transação criada e seu
`updatedAt` ajustado 15 minutos pra trás via SQL, o job reivindicou e reemitiu no próximo tick
(inclusive um backlog de transações `pending` de testes manuais anteriores). Ao religar o
`anti-fraud`, o backlog foi consumido e resolvido normalmente, sem nenhuma linha `pending` restante.

**Correção (a segurança de reemitir dependia de uma premissa sem teste):** o argumento acima ("é
seguro reemitir porque `EvaluateTransactionUseCase` é pura") não tinha nenhum teste que quebrasse
se essa premissa deixasse de valer. Adicionado um teste de determinismo em
`evaluate-transaction.use-case.test.ts`: chama a regra várias vezes com o mesmo input e confere que
o resultado nunca muda. Não impede alguém de tornar a regra stateful no futuro, mas garante que
essa mudança vai quebrar um teste (em vez de silenciosamente invalidar a garantia de segurança
desta seção) e forçar quem mexer ali a revisitar o argumento.

## Idempotência na criação de transação

**Decisão:** chave de idempotência opcional, gerada no cliente (`crypto.randomUUID()`), enviada
como header `Idempotency-Key` no `POST /transactions`. O formulário gera uma chave por tentativa de
envio, mantém a mesma entre reenvios de uma tentativa que falhou, e só gera uma chave nova após um
envio bem-sucedido (junto com o reset dos campos). Diferente do job de retentativa: aquele cobre
uma transação que já foi criada e travou no meio do fluxo assíncrono; isto cobre a criação em si
nunca duplicar por causa do mesmo clique/reenvio.

No banco, `Transaction.idempotencyKey` é `String? @unique` (nullable; requisição sem o header
funciona como antes). `TransactionRepository.createIdempotent()` nunca faz "checa se existe, então
cria" (brecha de corrida entre dois requests concorrentes com a mesma chave); sempre tenta criar
direto e só recupera do conflito (`P2002`) se ele acontecer, devolvendo a transação existente em
vez de propagar erro, mesmo princípio do `FOR UPDATE SKIP LOCKED` da retentativa de pendentes. Uma
repetição com a mesma chave nunca republica `transaction.created`.

**Por que não é over-engineering:** o botão já ficava `disabled` durante o envio, o que cobre a
maior parte do duplo-clique, mas é só trava de UI. Havia um buraco real: o drawer não fechava nem
limpava o formulário após um envio bem-sucedido, então clicar de novo sem perceber criava uma
segunda transação idêntica sem nenhuma proteção (encontrado durante esta implementação).

Verificado contra Postgres real: duas requisições com o mesmo `Idempotency-Key` e mesmo corpo
retornaram o mesmo `transactionExternalId`, com exatamente uma linha na tabela para essa transação.

## Serialização das mensagens Kafka publicadas

**Decisão (atualizada, ver "o que mudou"):** um `Serializer` customizado (`DomainEventSerializer`),
registrado como `serializer` do client Kafka em `ClientsModule.register`, serializa qualquer
payload publicado com `JSON.stringify` e o envelopa como `{ value: <string> }` automaticamente,
para toda chamada de `emit()` nesse client.

**Alternativas consideradas:** passar o payload de domínio direto pra `client.emit(topic, payload)`
(quebrado, ver "por quê"); pré-serializar e envelopar manualmente dentro de `publish()`, chamada
por chamada (decisão original, funcionava mas exigia lembrar disso em todo novo call site).

**Por quê:** o `KafkaRequestSerializer` do `@nestjs/microservices` trata qualquer objeto com uma
chave `key` ou `value` como se já fosse o envelope bruto da mensagem Kafka, não como dado de
domínio. Como `transaction.created` tem um campo chamado `value` (o valor da transação), passar o
payload direto fazia o serializer extrair só `payload.value` e descartar o resto: a mensagem
publicada virava literalmente `"120.5"`, sem `transactionExternalId`. Só apareceu rodando a
aplicação contra o Kafka real e inspecionando a mensagem; os testes unitários mockam `ClientKafka`
e não detectam esse comportamento, que mora na camada de serialização do NestJS.

**O que mudou:** a versão original fazia o wrapping dentro de `publish()`, chamada por chamada; um
client Kafka novo registrado sem passar por `KafkaPublisherService` reintroduziria o bug
silenciosamente. Mover o wrapping pro `serializer` do `ClientsModule` fecha essa brecha: é o ponto
de extensão que o próprio NestJS oferece pra esse problema. Reverificado contra Kafka real após a
mudança: a mensagem publicada continua com todos os campos intactos.

## Falha na publicação Kafka: retry com backoff, depois log

**Decisão:** `KafkaPublisherService.publish` assina o `Observable` que `ClientKafka.emit` devolve
(antes, nada assinava) envolvido em `defer(() => this.client.emit(...))` antes de aplicar `retry`
do RxJS: até 3 tentativas extras, backoff exponencial (500ms, 1s, 2s). Se todas falharem, loga um
`Logger.error` com o tópico e a razão; se alguma tentativa intermediária funcionar, não loga nada.

**Alternativas consideradas:** deixar sem tratamento (comportamento original); dead-letter/fila de
retry externa (Redis, tabela própria) pra mensagens que esgotam as tentativas.

**Por quê:** `client.emit()` conecta e despacha eagerly; o envio acontece mesmo sem ninguém
assinar o `Observable` devolvido, então nunca assinar não impedia a mensagem de sair. O problema é
que, se o envio falhar (broker fora do ar), o erro só chega ao `Subject` interno do `emit()`, que
ninguém escuta, e é descartado em silêncio. Nesse cenário a transação já foi persistida como
`pending` e nunca teria outra chance de virar `approved`/`rejected`, porque o evento nunca chegou
no `anti-fraud`. Detalhe importante: assinar o `Observable` sozinho não basta pro `retry`
funcionar, pois a assinatura conecta uma única vez e `retry` só re-observaria o mesmo resultado já
decidido. Envolver em `defer(() => client.emit(...))` faz cada tentativa chamar `emit()` de novo;
verificado com um teste que conta quantas vezes `emit()` é chamado sob timers falsos. Dead-letter
externo ficou fora por escopo: 3 tentativas com backoff cobrem o caso comum (Kafka brevemente
indisponível) sem infraestrutura nova.

## Bootstrap não depende do Kafka estar disponível (apps/transactions)

**Decisão:** as três conexões Kafka de `apps/transactions` (consumer de status via
`startAllMicroservices()`, producer via `KafkaPublisherService`, consumer de fan-out do SSE)
deixaram de ser aguardadas durante o boot: cada uma dispara sua conexão e segue em segundo plano,
logando um erro se falhar, em vez de travar `NestFactory.create()`/`app.listen()`. Junto disso, a
política de retry do kafkajs (`getKafkaClientOptions()`) passou de 5 tentativas (default) pra
1.000.000, mantendo o `maxRetryTime` de 30s, então cada conexão continua tentando reconectar
indefinidamente em vez de desistir.

**Alternativas consideradas:** manter as conexões aguardadas no boot (comportamento original);
aumentar só o retry sem tornar as conexões não-bloqueantes.

**Por quê:** rodando a aplicação de verdade contra um broker inalcançável, descobriu-se que o
consumer de status (`startAllMicroservices()`, aguardado antes de `app.listen()`) esgotava as 5
tentativas padrão do kafkajs em ~8.5s e lançava uma exceção não capturada, derrubando o processo
inteiro. `POST/GET /transactions` e `/health` pararam de funcionar mesmo não dependendo do Kafka
pra responder (só a atualização assíncrona de status depende). Aumentar só o retry evitaria a
queda do processo mas ainda deixaria o boot travado enquanto o Kafka não respondesse; as duas
mudanças juntas resolvem os dois problemas. `apps/anti-fraud` foi deixado de fora dessa mudança de
"não aguardar": é um microserviço Kafka puro sem HTTP, então não há nada que valha a pena liberar
antes da conexão, mas ganha a política de retry mais tolerante do mesmo jeito, já que
`getKafkaClientOptions()` é usado por ele também.

Verificado ao vivo: apontando `KAFKA_BROKERS` pra um endereço inalcançável, o `/health` respondeu
200 imediatamente e continuou respondendo por mais de 15s (bem além dos ~8.5s em que o processo
antes derrubava), com o processo seguindo vivo e tentando reconectar em segundo plano; `POST
/transactions` continuou funcionando normalmente (grava `pending`, só não publica até o Kafka
voltar). Com o Kafka real de volta, o fluxo completo (criação → antifraude → status atualizado)
foi conferido ponta a ponta sem nenhuma regressão.

## Regra antifraude e tratamento de mensagem malformada nos consumers

**Decisão:** `EvaluateTransactionUseCase` é uma regra pura (`value > 1000 → rejected`, senão
`approved`), sem estado, consistente com manter `anti-fraud` sem Postgres. Os três consumers
Kafka (dois em `transactions`, um em `anti-fraud`) validam o payload com o schema Zod do
contrato através de um helper compartilhado, `parseOrWarn` (`packages/contracts`): recebe o
schema, o payload e um callback de log, devolve o dado validado ou `null`. Uma mensagem que falha
a validação é logada (`Logger.warn`) e descartada, sem publicar nem lançar exceção.
`UpdateTransactionStatusUseCase` loga um aviso e não lança quando o `transactionExternalId`
recebido não corresponde a nenhuma transação existente.

**Alternativas consideradas:** retry automático da mensagem malformada; dead-letter queue; lançar a
exceção e deixar o handler padrão do NestJS tratar.

**Por quê:** uma mensagem malformada não vira válida numa nova tentativa, é a mesma mensagem. Sem
DLQ real (fora do escopo), a alternativa a logar e descartar seria travar o consumer indefinidamente
tentando reprocessar a mesma mensagem inválida, pior do que perder aquele evento. Retry e DLQ fazem
sentido pra falhas transitórias, não pra payload malformado, que é determinístico. O `parseOrWarn`
compartilhado existe porque o padrão "valida contra o schema, loga e ignora se falhar" era
reescrito à mão nos três consumers; centralizado em `packages/contracts` (pacote já compartilhado
pelos dois apps), uma mudança na política (ex.: adicionar métrica, mudar o nível de log) passa a
valer pros três de uma vez. Fica de fora dele o parse de JSON bruto do consumer de fan-out (só ele
lida com string crua vinda do `kafkajs` puro; os outros dois recebem o payload já deserializado
pelo wrapper `@nestjs/microservices`), porque forçar essa etapa nos três seria unificar coisas que
não são de fato iguais.

## ORM

**Decisão:** Prisma 6.19.3, não a linha 7.x recém-lançada.

**Por quê:** o Prisma 7 torna obrigatório o uso de driver adapters, move a URL do banco do
`schema.prisma` para um novo `prisma.config.ts` e renomeia o generator: uma migração real, não uma
troca trivial de versão. Pra uma fundação que precisa funcionar de forma previsível dentro do prazo
do desafio, a versão 6, madura e amplamente documentada, é a escolha mais segura.

## Modelagem de dados da transação

**Decisão:** `Transaction` com `id` UUID (o próprio `transactionExternalId` do contrato, sem id
interno separado), `value` como `Decimal @db.Decimal(18, 2)` e `status` como enum Prisma
(`pending`/`approved`/`rejected`). `transferTypeId` referencia `TransferType` via foreign key,
seedada via `prisma db seed`. Índices em `status`, `transferTypeId` e `createdAt`. `apps/anti-fraud`
segue sem Prisma/Postgres: a regra atual (`value > 1000`) não precisa de estado.

**Alternativas consideradas:** ULID como id público; `value` como inteiro em centavos (`BigInt`);
`transferTypeId` como enum fixo no código.

**Por quê:**

- **UUID, não ULID:** o README tipa `transactionExternalId` e os `accountExternalId*` como `Guid`,
  contrato fixo. ULID não é uma string UUID válida, e `packages/contracts` já valida com `z.uuid()`.
  Usar ULID só internamente foi considerado e descartado: o ganho de performance de escrita fica
  coberto por qualquer chave interna sequencial, sem precisar expor o id publicamente.
- **`NUMERIC(18,2)`, não `BigInt` em centavos:** os dois evitam o erro de arredondamento do
  `Float`. `NUMERIC` resolve nativamente, sem conversão manual centavos↔reais em toda borda; a
  vantagem do `BigInt` é performance em escala tipo Stripe, não o gargalo deste desafio. `NUMERIC`
  no Postgres é armazenamento de tamanho variável, então `(18,2)` em vez de `(14,2)` não tem custo.
- **`TransferType` como tabela, não enum fixo:** o README usa `transferTypeId: 1` só como exemplo,
  sem definir o vocabulário real de tipos. Tabela permite adicionar tipos sem deploy. Os nomes
  seedados (`Transferência entre contas`, `Pagamento`, `Saque`) são suposição, o enunciado não
  define o domínio de negócio real.

**Nota, validação de `value` na aplicação:** o `NUMERIC(18,2)` limita o banco, mas nada impedia um
`value` inválido de chegar até lá, em especial `Infinity` (o que `Number('1e400')` vira, e o que
`<input type="number">` aceita digitar), que `JSON.stringify` transforma em `null` antes de bater no
banco. Os dois schemas Zod (`create-transaction.dto.ts` no backend, `create-transaction.schema.ts`
no frontend) aplicam `.max()`, lendo o limite de `TRANSACTION_VALUE_MAX`/
`NEXT_PUBLIC_TRANSACTION_VALUE_MAX` no `.env` da raiz.

**Correção:** o limite não pode ser o teto literal da coluna. A primeira versão usava
`9999999999999999.99` (teto exato do `NUMERIC(18,2)`) como default. Bug relatado: criar uma
transação com exatamente esse valor devolvia 500, não 400/201. Causa raiz: `Number('9999999999999999.99')`
arredonda pra cima, pra exatamente `1e16` (doubles perdem precisão decimal nessa magnitude), e
`1e16` já não satisfaz a constraint real do Postgres ("must round to an absolute value less than
10^16"). O próprio limite usado na validação já estava um passo acima do que o banco aceita.
Trocado para `Number.MAX_SAFE_INTEGER` (`9007199254740991`), o maior inteiro que um double
representa sem arredondamento, com folga confortável abaixo do teto real da coluna. Verificado ao
vivo: o valor antigo agora volta 400 limpo; o novo máximo é aceito e persiste como 201; um valor
logo acima dele volta 400.

**Correção (precisão decimal):** os dois schemas Zod aceitavam `value`
com qualquer quantidade de casas decimais, mas a coluna é `NUMERIC(18,2)` (2 casas). Um valor como
`10.005` passava na validação e o Postgres arredondava em silêncio no insert, então uma consulta
posterior podia devolver um valor diferente do que foi enviado, sem nunca um 400 avisar disso.
Adicionado `.refine()` checando `Number(value.toFixed(2)) === value` nos dois schemas. Verificado
ao vivo: `10.005` agora volta 400 com mensagem de campo; `10.05` continua sendo aceito normalmente.

**Correção (`transferTypeId` inexistente):** o `catch` de
`createIdempotent` só tratava o conflito de unicidade da `idempotencyKey`; qualquer outro erro do
Prisma, incluindo a violação de FK de um `transferTypeId` que não existe, escapava cru pro handler
genérico do NestJS (`DomainExceptionFilter` só captura `DomainError`). Adicionado tratamento do
código `P2003` do Prisma, convertendo pra `ValidationError` (400). Verificado ao vivo:
`transferTypeId: 999999` agora volta `400 {"error":"VALIDATION","message":"transferTypeId 999999
não existe"}` em vez de um 500 opaco.

## Versão do TypeScript

**Decisão:** TypeScript 6.0.3, não a linha 7.x recém-lançada.

**Por quê:** `typescript-eslint@8.67.0` declara suporte a `typescript >=4.8.4 <6.1.0`. A 6.0.3 é a
última versão estável dentro dessa faixa; a 7.x quebraria o lint tipado.

## Remoção do Prisma do anti-fraud

**Decisão:** `apps/anti-fraud` não tem mais `prisma/schema.prisma` nem as dependências
`prisma`/`@prisma/client`, removidas depois de já terem sido adicionadas na fundação do projeto.

**Alternativas consideradas:** `output` customizado no generator de cada schema Prisma, pra cada
app gerar seu client num diretório próprio.

**Por quê:** `transactions` e `anti-fraud` resolviam pra mesma instância física de
`@prisma/client` no virtual store do pnpm. Como nenhum schema definia `output`, `prisma generate`
escrevia os dois no mesmo diretório default; o schema vazio do anti-fraud rodando depois do de
`transactions` apagava os models gerados, quebrando `nest build` de `transactions` de forma
dependente da ordem de instalação (reproduzido na prática ao rodar `pnpm install` de novo após
adicionar dependências no `web`). Como o anti-fraud nunca usou Prisma de verdade, remover o
scaffolding elimina a causa raiz em vez de mascará-la.

## Arquitetura do frontend

**Decisão:** TanStack Query no client pra toda busca/mutação de dados, sobre uma única rota do App
Router (`/`). Detalhe e criação de transação são drawers renderizados a partir de `/`, abertos via
parâmetros de busca na URL (`?tx=<id>`, `?new=1`) em vez de rotas próprias. Formulário de criação
validado com Zod, espelhando as mesmas regras do backend. Filtros/paginação também vivem na URL
(`?status=`/`?transferTypeId=`/`?from=`/`?to=`/`?page=`), ver seção própria abaixo.

**Alternativas consideradas:** buscar dados em Server Components com `fetch` nativo do Next.js;
manter filtros/paginação em `useState` local, não sincronizado com a URL (decisão original desta
entrada, revertida).

**Por quê:** a listagem precisa refazer a busca a cada mudança de filtro/página, mutar ao criar, e
fazer polling enquanto houver transação pendente, exatamente o que o TanStack Query resolve de
fábrica. Buscar em Server Components ainda exigiria refetch client-side pros mesmos três casos.

## Filtros e paginação na query string, não em estado local

**Decisão (revisão da anterior):** `filters`/`page` deixaram de ser `useState` na página e passaram
a ser derivados diretamente da URL, a mesma técnica já usada pros drawers (`?tx=`/`?new=`): fonte
única de verdade, sem estado duplicado entre React e URL. Mudar um filtro ou a página chama
`router.replace()` (não `push`), pra cada clique de filtro/paginação não virar uma entrada nova no
histórico. Abrir/fechar drawer continua em `router.push()`, mas passou a preservar os outros
parâmetros em vez de apagá-los.

**Por quê:** o pedido era permitir compartilhar/favoritar uma URL com filtro aplicado. Derivar de
`useSearchParams()` em vez de espelhar em `useState` evita estado duplicado. Descoberto ao
implementar: os dois links que abrem drawer (`Navbar`, card de `TransactionList`) usavam `href` com
query string fixa (`?new=1`, `?tx=<id>`), que no Next.js substitui a query inteira em vez de
mesclar; sem o fix, abrir um drawer já descartava qualquer filtro ativo. Corrigido com um helper
compartilhado (`withSearchParams`, em `apps/web/src/lib/query-params.ts`). Os inputs de data em
`TransactionFilters` também precisaram de ajuste: eram não controlados, então um filtro vindo da
URL não aparecia visualmente nos campos. Resolvido com `key`+`defaultValue` (remonta só quando o
valor externo muda) em vez de `value` controlado, mais simples e menos frágil de testar.

## Atualização de status pendente na interface

**Decisão (fundação, superada pela seção seguinte):** polling a cada 3 segundos (`refetchInterval`
do TanStack Query), ativo só enquanto a transação estivesse `pending`.

**Alternativas consideradas:** Server-Sent Events; WebSocket.

**Por quê (à época):** volume baixo de transações pendentes simultâneas visíveis numa tela, e
polling condicional não exige estado de conexão persistente no servidor.

**O que mudou:** a mesma pergunta ("pensando num pior cenário de escala, SSE não seria melhor?")
voltou depois. Ver a seção seguinte, que substitui o polling incondicional por SSE com o polling
reaproveitado como fallback degradado, em vez de removê-lo.

## SSE com fan-out via Kafka + polling como fallback degradado

**Decisão:** `GET /transactions/notifications/events` (`@Sse()`) transmite
`{ transactionExternalId, status }` via Server-Sent Events pra qualquer aba conectada, alimentado
por um segundo consumer Kafka independente por instância do `transactions` (`kafkajs` puro, não o
wrapper `@nestjs/microservices`, que amarra um único `groupId` a toda a conexão de microservice).
Esse segundo consumer usa `groupId` único gerado no boot (`sse-fanout-${randomUUID()}`), então cada
réplica fica sozinha no seu grupo e o Kafka entrega uma cópia de todo evento pra cada réplica em vez
de balancear carga, virando broadcast. O consumer original (`transactions-consumer`) continua o
único que grava o status no Postgres; o novo consumer só alimenta um `Subject` RxJS
(`TransactionEventsBroadcaster`) que o endpoint SSE assina.

No front, um único `EventSource` por aba (`useTransactionEvents`, montado uma vez via
`EventsBridge`) escreve direto no cache do TanStack Query (`setQueryData`/`invalidateQueries`) a
cada mensagem. Cache sozinho não resolve resiliência (canal quebrando em silêncio deixa o cache
parado), então:

1. Reconexão nativa do `EventSource`.
2. Reconciliação ampla (`invalidateQueries`) no primeiro `onopen` que segue um `onerror`, fechando
   qualquer janela sem conexão.
3. O polling de 3s não foi removido, virou fallback degradado. Um contexto leve
   (`TransactionEventsStatusContext`) conta erros consecutivos do `EventSource`; após 5 seguidos,
   marca `degraded: true`, e só então o `refetchInterval` volta a ligar.
4. `refetchOnWindowFocus` (padrão do TanStack Query) cobre de graça o caso do SSE morrer sem
   sinalizar `degraded` a tempo.

O contador de erros só reseta quando uma mensagem válida chega (`onmessage`, após passar validação),
não no `onopen`. Uma conexão que abre e cai sem entregar nada (timeout de proxy, réplica
reiniciando) dispara `onopen` antes de cada `onerror`; resetar ali zeraria o progresso rumo ao
`degraded`, e esse cenário ("flapping") nunca acionaria o fallback, justamente o caso que ele existe
pra cobrir.

Postgres continua a fonte da verdade; SSE é só um empurrão de baixa latência. Pior caso real é "a
tela demora até o próximo gatilho de fetch", nunca "mostra status errado pra sempre".

**Correção (reconciliação do detalhe enquanto a conexão está saudável):** a frase acima só valia
por completo enquanto o SSE estivesse `degraded` (aí o polling reconcilia). Com a conexão
saudável, `onmessage` só fazia `setQueryData` direto no cache do detalhe, sem nunca reconferir
contra o servidor: se a escrita no Postgres por trás daquele broadcast falhasse depois do evento
já ter sido publicado (o consumer que persiste e o de fan-out são dois consumers Kafka
independentes, sem garantia de ordem entre si), a tela ficava mostrando `approved`/`rejected`
definitivamente pra uma transação que continuava `pending` no banco, sem nada além de um reload
completo pra perceber. Corrigido chamando `invalidateQueries(['transaction', id])` logo depois do
`setQueryData`: a tela atualiza otimisticamente na hora, e um refetch em segundo plano confirma (ou
corrige) contra o servidor pouco depois.

**Correção (rajada de mensagens invalidando a listagem repetidamente):** cada mensagem válida
também invalidava `['transactions']` (a listagem) incondicionalmente, sem debounce. Várias
transações resolvendo perto uma da outra disparavam um refetch da listagem por mensagem, em vez de
um só. Essa invalidação específica (só a da listagem; a do detalhe acima continua imediata, já que
cada mensagem é de uma transação diferente e não tem o que agrupar) passou a ser adiada 250ms,
reiniciando o timer a cada nova mensagem: uma rajada de N eventos próximos vira um único refetch.

**Nota sobre a rota:** inicialmente a rota era `GET /transactions/events`, um único segmento, a
mesma forma que `:id` de `TransactionsController` casa. `:id` casa com qualquer valor num único
segmento, então `events` colidiria com `:id` se `TransactionsModule` registrasse antes de
`TransactionEventsModule`, defesa frágil por depender só da ordem de import. Restringir `:id` a um
formato de UUID direto na rota (`:id([0-9a-f-]{36})`) foi tentado e a aplicação não subia: o
`path-to-regexp@8` que o Express 5/Nest 11 desta stack usa removeu suporte à sintaxe
`:param(regex)` (só descoberto rodando a aplicação de verdade; `tsc`, `eslint` e os testes
unitários continuaram todos verdes com a rota quebrada). Adotado em vez disso: renomear a rota do
SSE pra ter dois segmentos depois de `transactions` (`notifications/events`), já que `:id` só casa
com um único segmento, tornando a colisão estruturalmente impossível. Bônus: "notifications" nomeia
o que o cliente recebe, não o mecanismo de transporte (SSE).

**Alternativas consideradas:** Redis Pub/Sub pro fan-out (infraestrutura fora da stack obrigatória
do desafio); instância dedicada/sticky session pra notificação (recria o SPOF que rodar N réplicas
tenta evitar); manter só polling incondicional; descartar o polling em favor de só SSE (rejeitado:
sem fallback, uma falha silenciosa do SSE deixaria a tela parada indefinidamente).

**Por quê:** responde de forma defensável ao "pior cenário de escala" sem infraestrutura nova, o
Kafka já é stack obrigatória, usado ao mesmo tempo como fila e como broadcast bus. Manter o polling
como fallback elimina o único ponto único de falha do desenho.

**Nota sobre os testes E2E:** o Playwright mockado também mocka `GET /transactions/notifications/events`.
Dois detalhes saíram diferentes do desenho original: só a primeira tentativa de conexão é
respondida com uma resposta SSE real (`retry: 50` + conexão fechada); as próximas quatro usam
`route.abort()`, porque qualquer resposta respondida dispara `onopen` antes do `onerror`, e o
`onopen` resetava o contador de falhas consecutivas (descoberto instrumentando o teste). Essa
mesma descoberta motivou uma correção no hook: o reset do contador saiu do `onopen` e passou pro
`onmessage`, só depois de mensagem válida, porque uma conexão real que abre e cai sem entregar nada
tem o mesmo comportamento. Existe ainda um terceiro teste, `eventsMode: 'push-single-event'`, que
faz o oposto: a conexão SSE fica saudável (nunca chega a `degraded`) e entrega o evento de verdade,
provando o caminho de push isoladamente.

## Estratégia de testes

**Decisão:** Vitest em todo o monorepo. No backend, testes de unidade pras regras de negócio (use
cases) com fakes de repositório/publisher, sem tocar banco ou Kafka de verdade, e os dois consumers
Kafka testados chamando `.handle()` diretamente. No frontend, Testing Library com
`getByRole`/`getByLabelText` antes de `data-testid`, mockando o módulo de API pra isolar os
componentes das chamadas de rede reais.

**Alternativas consideradas:** testes de integração do backend contra Postgres/Kafka reais no CI;
Playwright/Cypress end-to-end pro frontend.

**Por quê:** testes de unidade com fakes são determinísticos e rápidos; o CI atual não sobe
Postgres/Kafka. Todo o fluxo (criação → evento → antifraude → retorno → status atualizado, e as
telas do frontend) foi validado manualmente contra Postgres e Kafka reais durante o
desenvolvimento, revelando bugs reais que testes com mock não pegariam (a colisão de serialização
do Kafka e a colisão do Prisma Client, ambas documentadas acima). E2E automatizado com Playwright
entrou depois, com API mockada (ver próxima seção), o que deixa em aberto a lacuna entre "front
testado de ponta a ponta" e "sistema inteiro testado com Kafka real".

## E2E do frontend: Playwright com API mockada, não infraestrutura real

**Decisão:** `apps/web/e2e` cobre o fluxo de criar uma transação e ver o status trocar de
`Pendente` pra `Aprovada`/`Rejeitada` sozinho na tela, sem reload. As respostas de
`GET/POST /transactions` e `GET /transfer-types` são mockadas via `page.route()`: a primeira leitura
devolve `pending`, a segunda (disparada pelo polling de 3s) devolve `approved`/`rejected`. Nenhum
Postgres/Kafka/`anti-fraud` real entra em cena, só o `web` sobe (`next dev`), então o teste roda em
`pnpm quality`/CI sem infraestrutura extra.

**Alternativas consideradas:** E2E contra a stack real; não ter Playwright e manter só Testing
Library com API mockada no nível de componente.

**Por quê:** o objetivo é garantir que o frontend reage corretamente a uma mudança de status que
acontece fora do ciclo de request do usuário, o requisito do desafio. Isso não depende de Kafka/
antifraude serem reais, só de a API devolver um status diferente na segunda leitura. Rodar contra
infraestrutura real exigiria subir `docker compose` + migration/seed + os dois backends dentro do
CI, esforço à parte que não muda o que este teste valida. A regra de negócio do antifraude já tem
cobertura própria nos testes de unidade; o E2E mockado só prova que o front consome o resultado
corretamente. Não ter Playwright foi descartado porque Testing Library com mock no nível de
componente não exercita a navegação real do browser (drawer abrindo via URL, foco, etc.).

## Volume alto de escritas e leituras concorrentes

O enunciado pergunta como a aplicação lidaria com um volume alto de escritas e leituras
concorrentes. Não implementado, é uma resposta defendida, não construída.

- **Escrita da transação:** já é assíncrona por natureza; o `POST` grava com status `pending` e
  publica em Kafka, sem esperar a validação do antifraude, desacoplando o pico de escrita do
  processamento da regra de negócio. Pra volume ainda maior, os tópicos Kafka aceitam mais partições
  e mais instâncias de `anti-fraud` no mesmo `groupId` consumindo em paralelo.
- **Leitura, contenção (read replica):** os índices em `status`, `transferTypeId` e `createdAt` já
  cobrem os filtros da listagem. Com leitura pesada, o próximo passo é uma read replica do Postgres
  pra listagem/consulta, deixando o primary só pra escrita: leitura e escrita param de competir pelo
  mesmo banco, e leitura escala horizontalmente adicionando réplicas. Não implementado por não haver
  necessidade demonstrada no volume deste desafio.
- **Leitura, trabalho repetido (cache de busca):** um cache de resultado (ex.: Redis na frente do
  `GET /transactions`, TTL curto + invalidação no evento de status) evita bater no banco de novo pra
  buscas repetidas, um problema diferente do da read replica (menos consultas, não menos contenção
  por consulta), complementar e não concorrente. Não implementado, nenhum Redis foi instalado no
  `docker-compose`. Diferente do cache já existente no frontend: o TanStack Query cacheia localmente
  por aba/sessão, acelera a mesma sessão revisitando a mesma tela, mas não é compartilhado entre
  usuários/instâncias nem tira carga do Postgres sob concorrência real entre usuários diferentes.
- **Contenção na atualização de status:** o `UPDATE` por `transactionExternalId` já é uma escrita
  pontual por linha (via índice de PK), sem lock de tabela nem contenção cruzada entre transações
  diferentes.
- **Idempotência/at-least-once do Kafka:** deixada de fora deliberadamente (ver "Plumbing de
  mensageria Kafka"). Com volume alto, mensagens duplicadas se tornam mais prováveis; a forma
  correta seria uma chave de idempotência checada antes de aplicar o efeito, não implementada por
  falta de contexto de negócio sobre o que fazer em caso de conflito.
