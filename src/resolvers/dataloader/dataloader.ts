import db from '../../db.js';
import { GraphQLContext, TitleRow, PrincipalRow, NameRow } from '../../types/index.js';

export const dataloaderResolvers = {
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
    rating: async (parent: TitleRow, _args: unknown, context: GraphQLContext) => {
      return context.loaders!.ratingLoader.load(parent.tconst);
    },
    principals: async (parent: TitleRow, _args: unknown, context: GraphQLContext) => {
      return context.loaders!.principalsLoader.load(parent.tconst);
    },
  },

  Principal: {
    name: async (parent: PrincipalRow, _args: unknown, context: GraphQLContext) => {
      return context.loaders!.nameLoader.load(parent.nconst);
    },
  },

  Name: {
    known_for_titles: async (parent: NameRow, _args: unknown, context: GraphQLContext) => {
      return context.loaders!.knownForTitlesLoader.load(parent.nconst);
    },
  },
};
