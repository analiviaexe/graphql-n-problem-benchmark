import fs from 'fs';
import path from 'path';
import assert from 'assert';

const FIXTURES_DIR = path.resolve('benchmarks/fixtures');
const SNAPSHOT_FILE = path.join(FIXTURES_DIR, 'baseline-reference.json');

const QUERIES = {
  level1: {
    name: 'Nível 1 (Titles)',
    query: `
      query Level1 {
        getTitles(limit: 5) {
          tconst
          primary_title
          start_year
        }
      }
    `,
  },
  level2: {
    name: 'Nível 2 (Titles -> Rating)',
    query: `
      query Level2 {
        getTitles(limit: 5) {
          tconst
          primary_title
          rating {
            average_rating
            num_votes
          }
        }
      }
    `,
  },
  level3: {
    name: 'Nível 3 (Titles -> Principals -> Name)',
    query: `
      query Level3 {
        getTitles(limit: 5) {
          tconst
          primary_title
          principals {
            ordering
            category
            name {
              primary_name
            }
          }
        }
      }
    `,
  },
  level4: {
    name: 'Nível 4 (Titles -> Principals -> Name -> KnownForTitles)',
    query: `
      query Level4 {
        getTitles(limit: 5) {
          tconst
          primary_title
          principals {
            ordering
            category
            name {
              primary_name
              known_for_titles {
                tconst
                primary_title
              }
            }
          }
        }
      }
    `,
  },
};

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

  console.log(`\n🔍 Alvo GraphQL: ${targetUrl}`);

  if (isGenerate) {
    console.log(`📸 Modo: GERAÇÃO DO SNAPSHOT DE REFERÊNCIA (Golden Master)\n`);
    const snapshot = {};

    for (const [levelKey, { name, query }] of Object.entries(QUERIES)) {
      process.stdout.write(`⏳ Executando ${name}... `);
      const data = await executeQuery(targetUrl, query);
      snapshot[levelKey] = data;
      console.log('✅ OK');
    }

    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }

    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log(`\n🎉 Snapshot salvo com sucesso em: ${SNAPSHOT_FILE}\n`);
    process.exit(0);
  }

  console.log(`⚖️ Modo: VALIDAÇÃO DE PARIDADE CONTRA O GABARITO\n`);

  if (!fs.existsSync(SNAPSHOT_FILE)) {
    console.error(`❌ Erro: Arquivo de gabarito não encontrado: ${SNAPSHOT_FILE}`);
    console.error(`👉 Execute primeiro com o Baseline ativo: npm run test:parity -- --generate-snapshot\n`);
    process.exit(1);
  }

  const referenceSnapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8'));
  let allPassed = true;

  for (const [levelKey, { name, query }] of Object.entries(QUERIES)) {
    process.stdout.write(`🔎 Comparando ${name}... `);
    const expected = referenceSnapshot[levelKey];

    try {
      const actual = await executeQuery(targetUrl, query);
      assert.deepStrictEqual(actual, expected);
      console.log('✅ 100% IDÊNTICO (Paridade confirmada)');
    } catch (err) {
      allPassed = false;
      console.log('❌ DIVERGÊNCIA DETECTADA');
      console.error(`   Detalhes: ${err.message}`);
    }
  }

  if (allPassed) {
    console.log(`\n🏆 SUCESSO TOTAL: Todos os níveis retornaram payloads 100% idênticos ao Golden Master!\n`);
    process.exit(0);
  } else {
    console.error(`\n💥 FALHA DE PARIDADE: Há divergências entre a abordagem atual e o gabarito.\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n❌ Falha inesperada:`, err);
  process.exit(1);
});
