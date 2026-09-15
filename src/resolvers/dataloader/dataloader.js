import db from "../../db.js";

export const dataloaderResolver = {
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
        rating: async (parent, _, context) => {
            return context.loaders.ratingLoader.load(parent.tconst);
        },
        principals: async (parent, _, context) => {
            return context.loaders.principalsLoader.load(parent.tconst);
        }
    },

    Principal: {
        name: async (parent, _, context) => {
            return context.loaders.nameLoader.load(parent.nconst)
        }
    },

    Name: {
        known_for_titles: async (parent, _, context) => {
            return context.loaders.knownForTitlesLoader.load(parent.nconst);
        }
    }
}