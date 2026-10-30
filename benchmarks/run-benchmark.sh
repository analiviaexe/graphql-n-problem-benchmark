#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

REPETICOES=${REPETICOES:-3}
ESTRATEGIAS=${ESTRATEGIAS:-"baseline dataloader joinmonster"}
NIVEIS=${NIVEIS:-"1 2 3 4"}
PATAMARES=${PATAMARES:-"10,20,30,40,50"}
DURACAO_PATAMAR_S=${DURACAO_PATAMAR_S:-180}
DESCARTE_S=${DESCARTE_S:-10}
AQUECIMENTO_S=${AQUECIMENTO_S:-30}
AQUECIMENTO_VUS=${AQUECIMENTO_VUS:-5}
PAUSA_S=${PAUSA_S:-30}

COMPOSE=(docker compose -f docker/docker-compose.yml)
APPS=(app-baseline app-dataloader app-joinmonster)
declare -A PORTAS=([baseline]=4001 [dataloader]=4002 [joinmonster]=4003)
RESULTADOS="benchmarks/results/$(date +%Y%m%d-%H%M%S)"

log() { echo "[$(date +%H:%M:%S)] $*"; }

psql_bench() { docker exec postgres-bench psql -U postgres -d imdb_bench -At "$@"; }

snapshot_pgss() {
  psql_bench -c "COPY (
    SELECT queryid, calls, total_exec_time
    FROM pg_stat_statements
    WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'imdb_bench')
      AND query NOT LIKE '%pg_stat_statements%'
  ) TO STDOUT WITH CSV HEADER" > "$1"
}

contar_consultas() {
  local estrategia=$1 nivel=$2
  psql_bench -c "SELECT pg_stat_statements_reset();" > /dev/null
  URL="http://localhost:${PORTAS[$estrategia]}/graphql" NIVEL="$nivel" node --input-type=module - <<'EOF'
import { buildQueries } from './benchmarks/queries.js';
const res = await fetch(process.env.URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: buildQueries(50)[`level${process.env.NIVEL}`].query }),
});
if (!(await res.text()).startsWith('{"data"')) {
  console.error('Falha na requisição usada para contar as consultas');
  process.exit(1);
}
EOF
  psql_bench -c "SELECT coalesce(sum(calls), 0)
    FROM pg_stat_statements
    WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'imdb_bench')
      AND query NOT LIKE '%pg_stat_statements%'"
}

dormir_ate() {
  local restante=$(( $1 - $(date +%s) ))
  if (( restante > 0 )); then sleep "$restante"; fi
}

agendar_pgss() {
  local t0=$1 dir=$2 i=0
  for vus in ${PATAMARES//,/ }; do
    dormir_ate $(( t0 + i * DURACAO_PATAMAR_S + DESCARTE_S ))
    snapshot_pgss "$dir/pgss-${vus}vus-inicio.csv"
    dormir_ate $(( t0 + (i + 1) * DURACAO_PATAMAR_S ))
    snapshot_pgss "$dir/pgss-${vus}vus-fim.csv"
    i=$(( i + 1 ))
  done
}

coletar_docker_stats() {
  local arquivo=$1; shift
  echo "timestamp,container,cpu_perc,mem_usage" > "$arquivo"
  docker stats --format '{{.Name}},{{.CPUPerc}},{{.MemUsage}}' "$@" \
    | sed -u 's/\x1b\[[0-9;]*[A-Za-z]//g' \
    | while IFS= read -r linha; do
        [[ -n "$linha" ]] && echo "$(date +%s.%N),$linha"
      done >> "$arquivo"
}

rodar_k6() {
  local estrategia=$1 nivel=$2 modo=$3
  "${COMPOSE[@]}" run --rm -T \
    -e TARGET_URL="http://app-${estrategia}:${PORTAS[$estrategia]}/graphql" \
    -e LEVEL="$nivel" -e MODE="$modo" -e PATAMARES="$PATAMARES" \
    -e DURACAO_PATAMAR_S="$DURACAO_PATAMAR_S" -e DESCARTE_S="$DESCARTE_S" \
    -e AQUECIMENTO_S="$AQUECIMENTO_S" -e AQUECIMENTO_VUS="$AQUECIMENTO_VUS" \
    k6 run --quiet /benchmarks/k6/benchmark.js
}

rodada() {
  local rep=$1 estrategia=$2 nivel=$3
  local dir="$RESULTADOS/rep${rep}/${estrategia}/nivel${nivel}"
  mkdir -p "$dir"
  log "Repetição $rep · $estrategia · nível $nivel"

  "${COMPOSE[@]}" stop "${APPS[@]}" postgres > /dev/null
  sync
  echo 3 | sudo -n tee /proc/sys/vm/drop_caches > /dev/null
  "${COMPOSE[@]}" up -d --wait postgres "app-${estrategia}" > /dev/null

  rodar_k6 "$estrategia" "$nivel" warmup > /dev/null
  contar_consultas "$estrategia" "$nivel" > "$dir/consultas-por-req.txt"
  psql_bench -c "SELECT pg_stat_statements_reset();" > /dev/null

  coletar_docker_stats "$dir/docker-stats.csv" "app-${estrategia}" postgres-bench &
  local pid_stats=$!
  local t0
  t0=$(date +%s)
  echo "$t0" > "$dir/inicio.txt"
  agendar_pgss "$t0" "$dir" &
  local pid_pgss=$!

  rodar_k6 "$estrategia" "$nivel" test > "$dir/k6-resumo.json"

  wait "$pid_pgss" || true
  pkill -P "$pid_stats" 2> /dev/null || true
  kill "$pid_stats" 2> /dev/null || true
  wait "$pid_stats" 2> /dev/null || true

  sleep "$PAUSA_S"
}

if ! sudo -n tee /proc/sys/vm/drop_caches < /dev/null > /dev/null 2>&1; then
  echo "Erro: o sudo pede senha para o drop_caches. Configure /etc/sudoers.d/graphql-bench." >&2
  exit 1
fi
docker info > /dev/null

mkdir -p "$RESULTADOS"
{
  echo "repeticoes=$REPETICOES"
  echo "estrategias=$ESTRATEGIAS"
  echo "niveis=$NIVEIS"
  echo "patamares=$PATAMARES"
  echo "duracao_patamar_s=$DURACAO_PATAMAR_S"
  echo "descarte_s=$DESCARTE_S"
  echo "aquecimento_s=$AQUECIMENTO_S"
  echo "aquecimento_vus=$AQUECIMENTO_VUS"
} > "$RESULTADOS/execucao.txt"

log "Construindo a imagem das aplicações"
"${COMPOSE[@]}" build "${APPS[@]}" > /dev/null

for rep in $(seq 1 "$REPETICOES"); do
  for estrategia in $ESTRATEGIAS; do
    for nivel in $NIVEIS; do
      rodada "$rep" "$estrategia" "$nivel"
    done
  done
done

"${COMPOSE[@]}" stop "${APPS[@]}" > /dev/null
log "Concluído. Resultados em $RESULTADOS"
log "Para consolidar: node benchmarks/summarize.js $RESULTADOS"
