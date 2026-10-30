# graphql-n-problem-bench

Experimento que mede o impacto do problema N+1 em APIs GraphQL e compara três formas de resolver as mesmas consultas sobre uma base do IMDb: sem mitigação (Baseline), com DataLoader e com Join Monster.

## Pré-requisitos

- Linux
- Docker com Docker Compose, com o seu usuário no grupo `docker`
- Node.js 24

## Como rodar

### 1. Instalar e importar a base

```bash
git clone git@github.com:analiviaexe/graphql-n-problem-bench.git
cd graphql-n-problem-bench
npm install
docker compose -f docker/docker-compose.yml up -d postgres
npm run db:import
```

O importador baixa os arquivos do IMDb e carrega os filmes de 2010 a 2015. O experimento usa os arquivos de 01/09/2026, e os hashes estão em `importer/SHA256SUMS`.

### 2. Validar a paridade

Confere se as três estratégias devolvem a mesma resposta:

```bash
docker compose -f docker/docker-compose.yml up -d --build --wait app-baseline app-dataloader app-joinmonster
node benchmarks/validate-parity.js --url=http://localhost:4001/graphql
node benchmarks/validate-parity.js --url=http://localhost:4002/graphql
node benchmarks/validate-parity.js --url=http://localhost:4003/graphql
```

### 3. Rodar o benchmark

O script limpa o cache do Linux entre as rodadas e precisa usar `sudo` sem senha:

```bash
echo "$USER ALL=(root) NOPASSWD: /usr/bin/tee /proc/sys/vm/drop_caches" | sudo tee /etc/sudoers.d/graphql-bench
```

Teste rápido, de cerca de 2 minutos:

```bash
REPETICOES=1 ESTRATEGIAS=baseline NIVEIS=4 PATAMARES=50 DURACAO_PATAMAR_S=30 \
  AQUECIMENTO_S=5 PAUSA_S=0 ./benchmarks/run-benchmark.sh
```

Execução completa, de cerca de 10 horas:

```bash
./benchmarks/run-benchmark.sh
node benchmarks/summarize.js benchmarks/results/<execução>
```

Os resultados ficam em `benchmarks/results/`.

## Dados

Os dados vêm dos [IMDb Non-Commercial Datasets](https://developer.imdb.com/non-commercial-datasets/), que só podem ser usados para fins pessoais e não comerciais. Por isso, os arquivos não estão no repositório.
