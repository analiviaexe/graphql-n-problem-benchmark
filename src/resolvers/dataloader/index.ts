import DataLoader from 'dataloader';
import db from '../../db.js';
import { TitleRow, RatingRow, PrincipalRow, NameRow, DataLoaders } from '../../types/index.js';

async function batchRatings(tconsts: readonly string[]): Promise<(RatingRow | null)[]> {
  const query = 'SELECT * FROM ratings WHERE tconst = ANY($1)';
  const res = await db.query<RatingRow>(query, [tconsts as string[]]);
  const ratingMap = new Map<string, RatingRow>(res.rows.map((r) => [r.tconst, r]));

  return tconsts.map((tconst) => ratingMap.get(tconst) || null);
}

async function batchPrincipals(tconsts: readonly string[]): Promise<PrincipalRow[][]> {
  const query = 'SELECT * FROM principals WHERE tconst = ANY($1) ORDER BY ordering';
  const res = await db.query<PrincipalRow>(query, [tconsts as string[]]);

  const principalsMap = new Map<string, PrincipalRow[]>();
  tconsts.forEach((t) => principalsMap.set(t, []));

  res.rows.forEach((p) => {
    if (principalsMap.has(p.tconst)) {
      principalsMap.get(p.tconst)!.push(p);
    }
  });

  return tconsts.map((tconst) => principalsMap.get(tconst) || []);
}

async function batchNames(nconsts: readonly string[]): Promise<(NameRow | null)[]> {
  const query = 'SELECT * FROM names WHERE nconst = ANY($1)';
  const res = await db.query<NameRow>(query, [nconsts as string[]]);

  const nameMap = new Map<string, NameRow>(res.rows.map((n) => [n.nconst, n]));
  return nconsts.map((nconst) => nameMap.get(nconst) || null);
}

async function batchKnownForTitles(nconsts: readonly string[]): Promise<TitleRow[][]> {
  const query = `
    SELECT DISTINCT p.nconst, t.* 
    FROM titles t
    JOIN principals p ON t.tconst = p.tconst
    WHERE p.nconst = ANY($1)
    ORDER BY t.tconst ASC
  `;
  const res = await db.query<TitleRow & { nconst: string }>(query, [nconsts as string[]]);

  const knownForMap = new Map<string, TitleRow[]>();
  nconsts.forEach((n) => knownForMap.set(n, []));

  res.rows.forEach((row) => {
    if (knownForMap.has(row.nconst)) {
      const { nconst, ...titleRow } = row;
      knownForMap.get(row.nconst)!.push(titleRow as TitleRow);
    }
  });

  return nconsts.map((nconst) => knownForMap.get(nconst) || []);
}

export function createLoaders(): DataLoaders {
  return {
    ratingLoader: new DataLoader<string, RatingRow | null>(batchRatings),
    principalsLoader: new DataLoader<string, PrincipalRow[]>(batchPrincipals),
    nameLoader: new DataLoader<string, NameRow | null>(batchNames),
    knownForTitlesLoader: new DataLoader<string, TitleRow[]>(batchKnownForTitles),
  };
}
