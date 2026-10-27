# Infraestrutura Docker

Todos os serviços estão em `docker/docker-compose.yml` e usam a rede `graphql-bench-net`.

| Serviço | Contêiner | Porta | Papel |
|---|---|---|---|
| `postgres` | `postgres-bench` | 5432 | PostgreSQL 16 com a base do IMDb e o `pg_stat_statements` |
| `app-baseline` | `app-baseline` | 4001 | servidor GraphQL com `RESOLVER_TYPE=baseline` |
| `app-dataloader` | `app-dataloader` | 4002 | servidor GraphQL com `RESOLVER_TYPE=dataloader` |
| `app-joinmonster` | `app-joinmonster` | 4003 | servidor GraphQL com `RESOLVER_TYPE=joinmonster` |
| `k6` | (temporário) | — | gerador de carga, perfil `tools`, só sobe com `docker compose run` |

As três apps usam a mesma imagem (`graphql-bench-app`, gerada pelo `Dockerfile` na raiz). A estratégia muda apenas pela variável `RESOLVER_TYPE`.

## Recursos

O banco e as apps têm a mesma configuração:

- limite: 2 vCPU e 2 GB de RAM;
- reserva: 1 vCPU e 512 MB.

O k6 não tem limite, para que o gerador de carga não seja o gargalo.

## Dados

Os dados do banco ficam no volume nomeado `pgdata`. Use `docker compose stop` e `start` para parar e subir. `docker compose down` mantém o volume, mas `down -v` o apaga, e aí é preciso reimportar a base.

O `init-db.sql` só roda quando o volume está vazio. Ele cria as tabelas e a extensão `pg_stat_statements`, que exige `shared_preload_libraries=pg_stat_statements`, já definido no `command` do serviço.

## Comandos

Os comandos abaixo partem da raiz do projeto.

```bash
# subir o banco e importar a base
docker compose -f docker/docker-compose.yml up -d postgres
npm run db:import

# subir uma das apps
docker compose -f docker/docker-compose.yml up -d --build app-dataloader

# executar o benchmark completo
./benchmarks/run-benchmark.sh
node benchmarks/summarize.js benchmarks/results/<execução>
```