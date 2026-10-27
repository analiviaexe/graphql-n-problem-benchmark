import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { buildQueries } from './queries.js';

const FIXTURES_DIR = path.resolve('benchmarks/fixtures');
const SNAPSHOT_FILE = path.join(FIXTURES_DIR, 'baseline-reference.json');

const QUERIES = buildQueries(5);

async function executeQuery(url, query) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(json.errors, null, 2)}`);
  }

  return json.data;
}

async function main() {
  const args = process.argv.slice(2);
  const isGenerate = args.includes('--generate-snapshot');
  const urlArg = args.find((a) => a.startsWith('--url='));
  const targetUrl = urlArg ? urlArg.split('=')[1] : process.env.GRAPHQL_URL || 'http://localhost:4000/graphql';

  console.log(`Alvo: ${targetUrl}`);

  if (isGenerate) {
    console.log('Gerando gabarito a partir desta estratégia');
    const snapshot = {};

    for (const [levelKey, { name, query }] of Object.entries(QUERIES)) {
      process.stdout.write(`${name}... `);
      const data = await executeQuery(targetUrl, query);
      snapshot[levelKey] = data;
      console.log('ok');
    }

    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }

    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log(`Gabarito salvo em ${SNAPSHOT_FILE}`);
    process.exit(0);
  }

  console.log('Comparando com o gabarito');

  if (!fs.existsSync(SNAPSHOT_FILE)) {
    console.error(`Gabarito não encontrado: ${SNAPSHOT_FILE}`);
    console.error('Gere com o Baseline ativo: npm run test:parity -- --generate-snapshot');
    process.exit(1);
  }

  const referenceSnapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8'));
  let allPassed = true;

  for (const [levelKey, { name, query }] of Object.entries(QUERIES)) {
    process.stdout.write(`${name}... `);
    const expected = referenceSnapshot[levelKey];

    try {
      const actual = await executeQuery(targetUrl, query);
      assert.deepStrictEqual(actual, expected);
      console.log('idêntico');
    } catch (err) {
      allPassed = false;
      console.log('DIVERGENTE');
      console.error(err.message);
    }
  }

  if (allPassed) {
    console.log('Paridade confirmada nos 4 níveis');
    process.exit(0);
  } else {
    console.error('Falha de paridade');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
