import db from "../db.js";

export const baselineResolvers = {
  Query: {
    titles: async (_, { limit = 20, offset = 0 }) => {
      const query = 'SELECT * FROM titles ORDER BY tconst LIMIT $1 OFFSET $2';
      const res = await db.query(query, [limit, offset]);
      return res.rows;
    },

    title: async (_, { tconst }) => {
      const query = 'SELECT * FROM titles WHERE tconst = $1';
      const res = await db.query(query, [tconst]);
      return res.rows[0] || null;
    },
  },

  Title: {
    rating: async (parent) => {
      const query = 'SELECT * FROM ratings WHERE tconst = $1';
      const res = await db.query(query, [parent.tconst]);
      return res.rows[0] || null;
    },

    principals: async (parent) => {
      const query = 'SELECT * FROM principals WHERE tconst = $1 ORDER BY ordering';
      const res = await db.query(query, [parent.tconst]);
      return res.rows;
    },
  },

  Principal: {
    name: async (parent) => {
      const query = 'SELECT * FROM names WHERE nconst = $1';
      const res = await db.query(query, [parent.nconst]);
      return res.rows[0] || null;
    },
  },

  Name: {
    known_for_titles: async (parent) => {
      const query = `
        SELECT t.* 
        FROM titles t
        JOIN principals p ON t.tconst = p.tconst
        WHERE p.nconst = $1
        LIMIT 5
      `;
      const res = await db.query(query, [parent.nconst]);
      return res.rows;
    },
  },
};
