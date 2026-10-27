import db from '../db.js';
import { TitleRow, RatingRow, PrincipalRow, NameRow } from '../types/index.js';

export const baselineResolvers = {
  Query: {
    getTitles: async (_parent: unknown, { limit = 50, offset = 0 }: { limit?: number; offset?: number }) => {
      const query = 'SELECT * FROM titles ORDER BY tconst LIMIT $1 OFFSET $2';
      const res = await db.query<TitleRow>(query, [limit, offset]);
      return res.rows;
    },

    getTitleById: async (_parent: unknown, { tconst }: { tconst: string }) => {
      const query = 'SELECT * FROM titles WHERE tconst = $1';
      const res = await db.query<TitleRow>(query, [tconst]);
      return res.rows[0] || null;
    },
  },

  Title: {
    rating: async (parent: TitleRow, _args?: unknown, _context?: unknown) => {
      const query = 'SELECT * FROM ratings WHERE tconst = $1';
      const res = await db.query<RatingRow>(query, [parent.tconst]);
      return res.rows[0] || null;
    },

    principals: async (parent: TitleRow, _args?: unknown, _context?: unknown) => {
      const query = 'SELECT * FROM principals WHERE tconst = $1 ORDER BY ordering';
      const res = await db.query<PrincipalRow>(query, [parent.tconst]);
      return res.rows;
    },
  },

  Principal: {
    name: async (parent: PrincipalRow, _args?: unknown, _context?: unknown) => {
      const query = 'SELECT * FROM names WHERE nconst = $1';
      const res = await db.query<NameRow>(query, [parent.nconst]);
      return res.rows[0] || null;
    },
  },

  Name: {
    known_for_titles: async (parent: NameRow, _args?: unknown, _context?: unknown) => {
      const query = `
        SELECT DISTINCT t.*
        FROM titles t
        JOIN principals p ON t.tconst = p.tconst
        WHERE p.nconst = $1
        ORDER BY t.tconst ASC
      `;
      const res = await db.query<TitleRow>(query, [parent.nconst]);
      return res.rows;
    },
  },
};
