import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from './schema.js';
import { baselineResolvers } from './resolvers/baseline.js';
import { dataloaderResolver } from './resolvers/dataloader/dataloader.js';
import { createLoaders } from './resolvers/dataloader/index.js';

const app = express();
const RESOLVER_TYPE = process.env.RESOLVER_TYPE || 'baseline';
const resolversMap = {
    baseline: baselineResolvers,
    dataloader: dataloaderResolver,
};

const server = new ApolloServer({
    typeDefs,
    resolvers: resolversMap[RESOLVER_TYPE] || baselineResolvers,
    cache: 'bounded',
    persistedQueries: false,
});

await server.start();

app.use(
    '/graphql',
    cors(),
    express.json(),
    expressMiddleware(server, {
        context: async () => {
            if (RESOLVER_TYPE === 'dataloader') {
                return { loaders: createLoaders() };
            }
            return {};
        }
    })
);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
});
