# graphql-n-problem-bench

Experimento que mede o impacto do problema N+1 em APIs GraphQL e compara duas estratégias de mitigação: DataLoader e Join Monster.

## Sumário

- [Sobre](#sobre)
- [Tecnologias](#tecnologias)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Uso](#uso)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Dados](#dados)

## Sobre

O problema N+1 acontece quando uma consulta GraphQL aninhada dispara uma consulta ao banco para cada registro pai retornado. Este projeto compara três formas de resolver as mesmas consultas sobre uma base do IMDb:

| Estratégia | Como resolve |
|---|---|
| Baseline | resolvers diretos, sem mitigação (o N+1 acontece livremente) |
| DataLoader | agrupa as buscas de cada nível em uma consulta em lote |
| Join Monster | traduz a consulta GraphQL inteira para um único SQL com JOINs |

As três rodam a partir do mesmo código. Só muda a variável `RESOLVER_TYPE`. As consultas têm de 1 a 4 níveis de aninhamento, e cada estratégia é medida em latência (p50, p95, p99), vazão, consumo de CPU e memória e número de consultas ao banco.

## Tecnologias

- [Node.js](https://nodejs.org/) 24 e TypeScript
- [Express](https://expressjs.com/) 4 e [Apollo Server](https://www.apollographql.com/docs/apollo-server/) 5
- [DataLoader](https://github.com/graphql/dataloader) e [Join Monster](https://github.com/join-monster/join-monster)
- [PostgreSQL](https://www.postgresql.org/) 16 com `pg_stat_statements`
- [Docker Compose](https://docs.docker.com/compose/) e [Grafana k6](https://k6.io/)

## Pré-requisitos

- Docker com Docker Compose
- Node.js 24
- Linux, para a limpeza do cache entre rodadas do benchmark

## Instalação

```bash
git clone git@github.com:analiviaexe/graphql-n-problem-bench.git
cd graphql-n-problem-bench
npm install
```

Suba o banco e importe a base:

```bash
docker compose -f docker/docker-compose.yml up -d postgres
npm run db:import
```

O importador baixa os arquivos do IMDb e carrega todos os filmes de 2010 a 2015 (92.568 títulos, com elenco, avaliações e profissionais). Como o IMDb atualiza esses arquivos todo dia, o experimento usa os de 01/09/2026. Os hashes estão em `importer/SHA256SUMS`:

```bash
cd importer/downloads && sha256sum -c ../SHA256SUMS
```

## Uso

### Servidor local

```bash
npm run start:baseline      # ou start:dataloader, start:joinmonster
```

O servidor fica em `http://localhost:4000/graphql`.

### Validação de paridade

Confirma que as três estratégias devolvem exatamente a mesma resposta nos quatro níveis, comparando com um gabarito gerado a partir do Baseline (`benchmarks/fixtures/baseline-reference.json`):

```bash
npm run test:parity
```

### Benchmark

```bash
./benchmarks/run-benchmark.sh
node benchmarks/summarize.js benchmarks/results/<execução>
```

Cada rodada reinicia a aplicação e o banco, limpa o cache do sistema, aquece por 30 s e aplica uma escada de 10 a 50 usuários virtuais, com 3 min por patamar. São 3 repetições de 12 rodadas (3 estratégias × 4 níveis), cerca de 10 horas no total. O `summarize.js` gera dois CSVs: um com cada rodada e outro com média e desvio padrão por estratégia, nível e patamar.

O script usa `sudo` para limpar o cache. A regra do sudoers que evita o pedido de senha está em [`docker/README.md`](docker/README.md).

Teste rápido, de cerca de 2 minutos:

```bash
REPETICOES=1 ESTRATEGIAS=baseline NIVEIS=4 PATAMARES=50 DURACAO_PATAMAR_S=30 \
  AQUECIMENTO_S=5 PAUSA_S=0 ./benchmarks/run-benchmark.sh
```

## Estrutura do projeto

```
├── src/
│   ├── resolvers/      Baseline, DataLoader e Join Monster
│   ├── schema.ts
│   └── server.ts
├── benchmarks/
│   ├── k6/             script de carga
│   ├── fixtures/       gabarito da paridade
│   ├── queries.js      as quatro consultas do experimento
│   ├── run-benchmark.sh
│   └── summarize.js
├── importer/           importação da base do IMDb
└── docker/             docker-compose.yml e schema do banco
```

## Dados

Os dados vêm dos [IMDb Non-Commercial Datasets](https://developer.imdb.com/non-commercial-datasets/), que só podem ser usados para fins pessoais e não comerciais. Por isso, os arquivos não estão no repositório.
