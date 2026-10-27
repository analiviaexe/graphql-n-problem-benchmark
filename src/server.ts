import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { ApolloServerPluginUsageReportingDisabled } from '@apollo/server/plugin/disabled';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './schema.js';
import { baselineResolvers } from './resolvers/baseline.js';
import { dataloaderResolver } from './resolvers/dataloader/dataloader.js';
import { createLoaders } from './resolvers/dataloader/index.js';
import { joinMonsterResolvers } from './resolvers/joinmonster/joinmonster.js';
import { attachJoinMonsterMetadata } from './resolvers/joinmonster/metadata.js';
import { GraphQLContext } from './types/index.js';

const app = express();
const RESOLVER_TYPE = process.env.RESOLVER_TYPE || 'baseline';

const resolversMap: Record<string, any> = {
  baseline: baselineResolvers,
  dataloader: dataloaderResolver,
  joinmonster: joinMonsterResolvers,
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers: resolversMap[RESOLVER_TYPE] || baselineResolvers,
});

if (RESOLVER_TYPE === 'joinmonster') {
  attachJoinMonsterMetadata(schema);
}

const server = new ApolloServer<GraphQLContext>({
  schema,
  cache: 'bounded',
  persistedQueries: false,
  documentStore: null,
  plugins: [ApolloServerPluginUsageReportingDisabled()],
});

await server.start();

app.use(
  '/graphql',
  cors(),
  express.json(),
  expressMiddleware<GraphQLContext>(server, {
    context: async (): Promise<GraphQLContext> => {
      if (RESOLVER_TYPE === 'dataloader') {
        return { loaders: createLoaders() };
      }
      return {};
    },
  })
);

app.get('/health', (_req, res) => {
  res.send('ok');
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Servidor em http://localhost:${PORT}/graphql (${RESOLVER_TYPE})`);
});
