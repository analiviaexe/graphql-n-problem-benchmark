import fs from 'fs';
import path from 'path';

const runDir = process.argv[2];
if (!runDir || !fs.existsSync(runDir)) {
  console.error('Uso: node benchmarks/summarize.js benchmarks/results/<execução>');
  process.exit(1);
}

function readCsv(file) {
  const [header, ...lines] = fs.readFileSync(file, 'utf-8').trim().split('\n');
  const cols = header.split(',');
  return lines.map((line) => {
    const values = line.split(',');
    return Object.fromEntries(cols.map((c, i) => [c, values[i]]));
  });
}

const UNITS = { B: 1 / 1048576, KiB: 1 / 1024, MiB: 1, GiB: 1024 };
function toMiB(text) {
  const [, value, unit] = /([\d.]+)\s*(\w+)/.exec(text);
  return Number(value) * UNITS[unit];
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const stdev = (xs) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};

function dbDelta(dir, vus) {
  const before = new Map(readCsv(path.join(dir, `pgss-${vus}vus-inicio.csv`)).map((r) => [r.queryid, r]));
  let calls = 0;
  let totalMs = 0;
  for (const r of readCsv(path.join(dir, `pgss-${vus}vus-fim.csv`))) {
    const b = before.get(r.queryid);
    calls += Number(r.calls) - (b ? Number(b.calls) : 0);
    totalMs += Number(r.total_exec_time) - (b ? Number(b.total_exec_time) : 0);
  }
  return { calls, totalMs };
}

const rows = [];
for (const rep of fs.readdirSync(runDir).filter((d) => d.startsWith('rep')).sort()) {
  for (const strategy of fs.readdirSync(path.join(runDir, rep)).sort()) {
    for (const level of fs.readdirSync(path.join(runDir, rep, strategy)).sort()) {
      const dir = path.join(runDir, rep, strategy, level);
      const summary = JSON.parse(fs.readFileSync(path.join(dir, 'k6-resumo.json'), 'utf-8'));
      const t0 = Number(fs.readFileSync(path.join(dir, 'inicio.txt'), 'utf-8'));
      const stats = readCsv(path.join(dir, 'docker-stats.csv'));

      summary.patamares.forEach((p, i) => {
        const start = t0 + i * summary.duracao_patamar_s + summary.descarte_s;
        const end = t0 + (i + 1) * summary.duracao_patamar_s;
        const window = stats.filter((s) => s.timestamp >= start && s.timestamp < end);
        const app = window.filter((s) => s.container === `app-${strategy}`);
        const pg = window.filter((s) => s.container === 'postgres-bench');
        const db = dbDelta(dir, p.vus);

        rows.push({
          repeticao: Number(rep.slice(3)),
          estrategia: strategy,
          nivel: summary.nivel,
          vus: p.vus,
          p50_ms: p.latencia_ms.med,
          p95_ms: p.latencia_ms['p(95)'],
          p99_ms: p.latencia_ms['p(99)'],
          vazao_rps: p.vazao_rps,
          taxa_erro: p.taxa_erro,
          app_cpu_perc: mean(app.map((s) => parseFloat(s.cpu_perc))),
          app_mem_max_mib: Math.max(...app.map((s) => toMiB(s.mem_usage))),
          pg_cpu_perc: mean(pg.map((s) => parseFloat(s.cpu_perc))),
          db_consultas_por_req: db.calls / p.requisicoes_ok,
          db_tempo_total_ms: db.totalMs,
        });
      });
    }
  }
}

function writeCsv(file, data) {
  const cols = Object.keys(data[0]);
  const format = (v) => (typeof v === 'number' ? Number(v.toFixed(3)) : v);
  const lines = data.map((r) => cols.map((c) => format(r[c])).join(','));
  fs.writeFileSync(file, [cols.join(','), ...lines].join('\n') + '\n');
}

writeCsv(path.join(runDir, 'consolidado.csv'), rows);

const metrics = ['p50_ms', 'p95_ms', 'p99_ms', 'vazao_rps', 'app_cpu_perc', 'app_mem_max_mib', 'pg_cpu_perc', 'db_consultas_por_req'];
const groups = Map.groupBy(rows, (r) => `${r.estrategia}|${r.nivel}|${r.vus}`);
const aggregated = [...groups.values()].map((group) => {
  const row = { estrategia: group[0].estrategia, nivel: group[0].nivel, vus: group[0].vus };
  for (const m of metrics) {
    const values = group.map((r) => r[m]);
    row[`${m}_media`] = mean(values);
    row[`${m}_dp`] = stdev(values);
  }
  return row;
});

writeCsv(path.join(runDir, 'agregado.csv'), aggregated);
console.log(`Gerados consolidado.csv (${rows.length} linhas) e agregado.csv (${aggregated.length} linhas) em ${runDir}`);
