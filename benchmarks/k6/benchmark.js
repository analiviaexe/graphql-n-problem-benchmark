import http from 'k6/http';
import exec from 'k6/execution';
import { Trend, Counter } from 'k6/metrics';
import { buildQueries } from '../queries.js';

const TARGET_URL = __ENV.TARGET_URL;
const LEVEL = __ENV.LEVEL || '1';
const MODE = __ENV.MODE || 'test';
const LIMIT = 50;
const PATAMARES = (__ENV.PATAMARES || '10,20,30,40,50').split(',').map(Number);
const DURACAO_PATAMAR_S = Number(__ENV.DURACAO_PATAMAR_S || 180);
const DESCARTE_S = Number(__ENV.DESCARTE_S || 10);
const AQUECIMENTO_S = Number(__ENV.AQUECIMENTO_S || 30);
const AQUECIMENTO_VUS = Number(__ENV.AQUECIMENTO_VUS || 5);

const QUERY = buildQueries(LIMIT)[`level${LEVEL}`].query;
const BODY = JSON.stringify({ query: QUERY });
const PARAMS = { headers: { 'Content-Type': 'application/json' } };

const latencia = new Trend('latencia_ms', true);
const reqOk = new Counter('req_ok');
const reqFalha = new Counter('req_falha');

function cenarios() {
  if (MODE === 'warmup') {
    return {
      aquecimento: { executor: 'constant-vus', vus: AQUECIMENTO_VUS, duration: `${AQUECIMENTO_S}s` },
    };
  }
  const result = {};
  PATAMARES.forEach((vus, i) => {
    result[`patamar_${vus}`] = {
      executor: 'constant-vus',
      vus,
      duration: `${DURACAO_PATAMAR_S}s`,
      startTime: `${i * DURACAO_PATAMAR_S}s`,
      gracefulStop: `${DESCARTE_S}s`,
      tags: { patamar: String(vus) },
    };
  });
  return result;
}

function limiaresPorPatamar() {
  const result = {};
  for (const vus of PATAMARES) {
    result[`latencia_ms{patamar:${vus}}`] = ['max>=0'];
    result[`req_ok{patamar:${vus}}`] = ['count>=0'];
    result[`req_falha{patamar:${vus}}`] = ['count>=0'];
  }
  return result;
}

export const options = {
  scenarios: cenarios(),
  thresholds: MODE === 'test' ? limiaresPorPatamar() : {},
  summaryTrendStats: ['avg', 'min', 'med', 'p(95)', 'p(99)', 'max', 'count'],
};

export function setup() {
  return { inicio: Date.now() };
}

export default function () {
  const decorrido = (Date.now() - exec.scenario.startTime) / 1000;
  const res = http.post(TARGET_URL, BODY, PARAMS);

  if (MODE !== 'test' || decorrido < DESCARTE_S || decorrido >= DURACAO_PATAMAR_S) return;

  const ok = res.status === 200 && typeof res.body === 'string' && res.body.startsWith('{"data"');
  latencia.add(res.timings.duration);
  if (ok) reqOk.add(1);
  else reqFalha.add(1);
}

export function handleSummary(data) {
  if (MODE !== 'test') return { stdout: '' };

  const janela = DURACAO_PATAMAR_S - DESCARTE_S;
  const valor = (nome) => (data.metrics[nome] ? data.metrics[nome].values : null);
  const resumo = {
    nivel: Number(LEVEL),
    limit: LIMIT,
    alvo: TARGET_URL,
    inicio_ms: data.setup_data ? data.setup_data.inicio : null,
    duracao_patamar_s: DURACAO_PATAMAR_S,
    descarte_s: DESCARTE_S,
    patamares: PATAMARES.map((vus) => {
      const ok = valor(`req_ok{patamar:${vus}}`);
      const falha = valor(`req_falha{patamar:${vus}}`);
      const nOk = ok ? ok.count : 0;
      const nFalha = falha ? falha.count : 0;
      return {
        vus,
        latencia_ms: valor(`latencia_ms{patamar:${vus}}`),
        requisicoes_ok: nOk,
        requisicoes_falha: nFalha,
        vazao_rps: nOk / janela,
        taxa_erro: nOk + nFalha > 0 ? nFalha / (nOk + nFalha) : 0,
      };
    }),
  };
  return { stdout: JSON.stringify(resumo, null, 2) + '\n' };
}
