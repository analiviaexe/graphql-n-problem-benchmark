import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import https from 'node:https';
import pg from 'pg';

const { Pool } = pg;

const DOWNLOAD_DIR = path.resolve('importer', 'downloads');
const START_YEAR_MIN = 2010;
const START_YEAR_MAX = 2015;
const BATCH_SIZE = 500;

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'imdb_bench',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgrespassword',
};

const FILES = {
  titleBasics: { filename: 'title.basics.tsv.gz', url: 'https://datasets.imdbws.com/title.basics.tsv.gz' },
  titleRatings: { filename: 'title.ratings.tsv.gz', url: 'https://datasets.imdbws.com/title.ratings.tsv.gz' },
  titlePrincipals: { filename: 'title.principals.tsv.gz', url: 'https://datasets.imdbws.com/title.principals.tsv.gz' },
  nameBasics: { filename: 'name.basics.tsv.gz', url: 'https://datasets.imdbws.com/name.basics.tsv.gz' },
};

function parseNullable(val) {
  return (!val || val === '\\N') ? null : val;
}

function parseIntNullable(val) {
  const parsed = parseNullable(val);
  if (parsed === null) return null;
  const num = parseInt(parsed, 10);
  return isNaN(num) ? null : num;
}

function parseFloatNullable(val) {
  const parsed = parseNullable(val);
  if (parsed === null) return null;
  const num = parseFloat(parsed);
  return isNaN(num) ? null : num;
}

async function downloadFile(url, destPath) {
  if (fs.existsSync(destPath)) {
    const stats = fs.statSync(destPath);
    if (stats.size > 1000) return;
    fs.unlinkSync(destPath);
  }
  
  console.log(`Baixando ${path.basename(destPath)}...`);
  const file = fs.createWriteStream(destPath);
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) return reject(new Error(`HTTP ${response.statusCode}`));
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function batchInsert(pool, tableName, columns, rows) {
  if (rows.length === 0) return;
  const colNames = columns.join(', ');
  const valuePlaceholders = [];
  const queryParams = [];
  let paramIndex = 1;

  for (const row of rows) {
    const placeholders = [];
    for (const val of row) {
      placeholders.push(`$${paramIndex++}`);
      queryParams.push(val);
    }
    valuePlaceholders.push(`(${placeholders.join(', ')})`);
  }

  const query = `INSERT INTO ${tableName} (${colNames}) VALUES ${valuePlaceholders.join(', ')} ON CONFLICT DO NOTHING;`;
  await pool.query(query, queryParams);
}

async function runImport() {
  if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const pool = new Pool(DB_CONFIG);

  try {
    for (const fileKey of Object.keys(FILES)) {
      const fileInfo = FILES[fileKey];
      await downloadFile(fileInfo.url, path.join(DOWNLOAD_DIR, fileInfo.filename));
    }

    const targetTitles = new Set();
    const targetNames = new Set();

    await pool.query('TRUNCATE TABLE principals, ratings, titles, names CASCADE;');
    await pool.query('ALTER TABLE principals DROP CONSTRAINT IF EXISTS principals_nconst_fkey;');

    const titlesStream = readline.createInterface({
      input: fs.createReadStream(path.join(DOWNLOAD_DIR, FILES.titleBasics.filename)).pipe(zlib.createGunzip()),
      crlfDelay: Infinity,
    });

    let isHeader = true;
    let titleBatch = [];
    let titleCount = 0;

    for await (const line of titlesStream) {
      if (isHeader) { isHeader = false; continue; }

      const tab1 = line.indexOf('\t');
      if (tab1 === -1) continue;
      const tconst = line.substring(0, tab1);

      const cols = line.split('\t');
      if (cols[1] !== 'movie') continue;
      const startYear = parseIntNullable(cols[5]);
      if (startYear === null || startYear < START_YEAR_MIN || startYear > START_YEAR_MAX) continue;

      targetTitles.add(tconst);
      titleBatch.push([
        tconst, cols[1], cols[2], parseNullable(cols[3]),
        cols[4] === '1', parseIntNullable(cols[5]), parseIntNullable(cols[6]),
        parseIntNullable(cols[7]), parseNullable(cols[8])
      ]);
      titleCount++;

      if (titleBatch.length >= BATCH_SIZE) {
        await batchInsert(pool, 'titles', ['tconst', 'title_type', 'primary_title', 'original_title', 'is_adult', 'start_year', 'end_year', 'runtime_minutes', 'genres'], titleBatch);
        titleBatch = [];
      }
    }
    if (titleBatch.length > 0) {
      await batchInsert(pool, 'titles', ['tconst', 'title_type', 'primary_title', 'original_title', 'is_adult', 'start_year', 'end_year', 'runtime_minutes', 'genres'], titleBatch);
    }
    console.log(`[1/4] Titles: ${titleCount} inseridos.`);

    const ratingsStream = readline.createInterface({
      input: fs.createReadStream(path.join(DOWNLOAD_DIR, FILES.titleRatings.filename)).pipe(zlib.createGunzip()),
      crlfDelay: Infinity,
    });

    isHeader = true;
    let ratingsBatch = [];
    let ratingsCount = 0;

    for await (const line of ratingsStream) {
      if (isHeader) { isHeader = false; continue; }
      const tab1 = line.indexOf('\t');
      if (tab1 === -1) continue;
      const tconst = line.substring(0, tab1);
      if (!targetTitles.has(tconst)) continue;

      const cols = line.split('\t');
      ratingsBatch.push([tconst, parseFloatNullable(cols[1]), parseIntNullable(cols[2])]);
      ratingsCount++;

      if (ratingsBatch.length >= BATCH_SIZE) {
        await batchInsert(pool, 'ratings', ['tconst', 'average_rating', 'num_votes'], ratingsBatch);
        ratingsBatch = [];
      }
    }
    if (ratingsBatch.length > 0) {
      await batchInsert(pool, 'ratings', ['tconst', 'average_rating', 'num_votes'], ratingsBatch);
    }
    console.log(`[2/4] Ratings: ${ratingsCount} inseridos.`);

    const insertPrincipalsStream = readline.createInterface({
      input: fs.createReadStream(path.join(DOWNLOAD_DIR, FILES.titlePrincipals.filename)).pipe(zlib.createGunzip()),
      crlfDelay: Infinity,
    });

    isHeader = true;
    let principalsBatch = [];
    let principalsCount = 0;

    for await (const line of insertPrincipalsStream) {
      if (isHeader) { isHeader = false; continue; }
      const tab1 = line.indexOf('\t');
      if (tab1 === -1) continue;
      const tconst = line.substring(0, tab1);
      if (!targetTitles.has(tconst)) continue;

      const cols = line.split('\t');
      targetNames.add(cols[2]);
      principalsBatch.push([tconst, parseIntNullable(cols[1]), cols[2], parseNullable(cols[3]), parseNullable(cols[4]), parseNullable(cols[5])]);
      principalsCount++;

      if (principalsBatch.length >= BATCH_SIZE) {
        await batchInsert(pool, 'principals', ['tconst', 'ordering', 'nconst', 'category', 'job', 'characters'], principalsBatch);
        principalsBatch = [];
      }
    }
    if (principalsBatch.length > 0) {
      await batchInsert(pool, 'principals', ['tconst', 'ordering', 'nconst', 'category', 'job', 'characters'], principalsBatch);
    }
    console.log(`[3/4] Principals: ${principalsCount} inseridos.`);

    const namesStream = readline.createInterface({
      input: fs.createReadStream(path.join(DOWNLOAD_DIR, FILES.nameBasics.filename)).pipe(zlib.createGunzip()),
      crlfDelay: Infinity,
    });

    isHeader = true;
    let namesBatch = [];
    let namesCount = 0;

    for await (const line of namesStream) {
      if (isHeader) { isHeader = false; continue; }
      const tab1 = line.indexOf('\t');
      if (tab1 === -1) continue;
      const nconst = line.substring(0, tab1);
      if (!targetNames.has(nconst)) continue;

      const cols = line.split('\t');
      namesBatch.push([nconst, cols[1], parseIntNullable(cols[2]), parseIntNullable(cols[3]), parseNullable(cols[4]), parseNullable(cols[5])]);
      namesCount++;

      if (namesBatch.length >= BATCH_SIZE) {
        await batchInsert(pool, 'names', ['nconst', 'primary_name', 'birth_year', 'death_year', 'primary_profession', 'known_for_titles'], namesBatch);
        namesBatch = [];
      }
    }
    if (namesBatch.length > 0) {
      await batchInsert(pool, 'names', ['nconst', 'primary_name', 'birth_year', 'death_year', 'primary_profession', 'known_for_titles'], namesBatch);
    }
    console.log(`[4/4] Names: ${namesCount} inseridos.`);

    await pool.query('DELETE FROM principals WHERE NOT EXISTS (SELECT 1 FROM names WHERE names.nconst = principals.nconst);');

    await pool.query('ALTER TABLE principals ADD CONSTRAINT principals_nconst_fkey FOREIGN KEY (nconst) REFERENCES names(nconst) ON DELETE CASCADE;');

    console.log('Importação concluída');
  } catch (err) {
    if (err.message.includes('unexpected end of file') || err.code === 'Z_BUF_ERROR') {
      console.error('Arquivo compactado corrompido. Confira com: cd importer/downloads && sha256sum -c ../SHA256SUMS');
    } else {
      console.error('Erro na importação:', err.message);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runImport();
