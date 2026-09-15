import DataLoader from 'dataloader';
import db from '../../db.js';

async function batchRatings(tconsts) {
    const query = 'SELECT * FROM ratings WHERE tconst = ANY($1)';
    const res = await db.query(query, [tconsts]);
    const ratingMap = new Map(res.rows.map((r) => [r.tconst, r]));

    return tconsts.map((tconst) => ratingMap.get(tconst) || null);
}

async function batchPrincipals(tconsts) {
    const query = 'SELECT * FROM principals WHERE tconst = ANY($1) ORDER BY ordering';
    const res = await db.query(query, [tconsts]);

    const principalsMap = new Map();
    tconsts.forEach((t) => principalsMap.set(t, []));

    res.rows.forEach((p) => {
        if (principalsMap.has(p.tconst)) {
            principalsMap.get(p.tconst).push(p);
        }
    });

    return tconsts.map((tconst) => principalsMap.get(tconst) || []);
}

async function batchNames(nconsts) {
    const query = 'SELECT * FROM names WHERE nconst = ANY($1)';
    const res = await db.query(query, [nconsts]);

    const nameMap = new Map(res.rows.map((n) => [n.nconst, n]));
    return nconsts.map((nconst) => nameMap.get(nconst) || null);
}

async function batchKnownForTitles(nconsts) {
    const query = `
    SELECT p.nconst, t.* 
    FROM titles t
    JOIN principals p ON t.tconst = p.tconst
    WHERE p.nconst = ANY($1)
  `;
    const res = await db.query(query, [nconsts]);

    const knownForMap = new Map();
    nconsts.forEach((n) => knownForMap.set(n, []));

    res.rows.forEach((row) => {
        if (knownForMap.has(row.nconst)) {
            if (knownForMap.get(row.nconst).length < 5) {
                knownForMap.get(row.nconst).push(row);
            }
        }
    });

    return nconsts.map((nconst) => knownForMap.get(nconst) || []);
}

export function createLoaders() {
    return {
        ratingLoader: new DataLoader(batchRatings),
        principalsLoader: new DataLoader(batchPrincipals),
        nameLoader: new DataLoader(batchNames),
        knownForTitlesLoader: new DataLoader(batchKnownForTitles),
    };
}


