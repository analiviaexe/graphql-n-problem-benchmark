#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ $# -lt 1 ]]; then
  echo "Uso: ./benchmarks/count-rows.sh benchmarks/results/<execução>" >&2
  exit 1
fi

SAIDA="$1/linhas-por-requisicao.csv"
COMPOSE=(docker compose -f docker/docker-compose.yml)
declare -A PORTAS=([baseline]=4001 [dataloader]=4002 [joinmonster]=4003)

psql_bench() { docker exec postgres-bench psql -U postgres -d imdb_bench -At "$@"; }

"${COMPOSE[@]}" up -d --wait postgres app-baseline app-dataloader app-joinmonster > /dev/null

echo "estrategia,nivel,consultas,linhas" > "$SAIDA"
for estrategia in baseline dataloader joinmonster; do
  for nivel in 1 2 3 4; do
    psql_bench -c "SELECT pg_stat_statements_reset();" > /dev/null
    URL="http://localhost:${PORTAS[$estrategia]}/graphql" NIVEL="$nivel" node --input-type=module - <<'EOF'
import { buildQueries } from './benchmarks/queries.js';
const res = await fetch(process.env.URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: buildQueries(50)[`level${process.env.NIVEL}`].query }),
});
if (!(await res.text()).startsWith('{"data"')) {
  console.error('Falha na requisição');
  process.exit(1);
}
EOF
    totais=$(psql_bench -F, -c "SELECT coalesce(sum(calls), 0), coalesce(sum(rows), 0)
      FROM pg_stat_statements
      WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'imdb_bench')
        AND query NOT LIKE '%pg_stat_statements%'")
    echo "$estrategia,$nivel,$totais" >> "$SAIDA"
  done
done

"${COMPOSE[@]}" stop app-baseline app-dataloader app-joinmonster > /dev/null
cat "$SAIDA"
