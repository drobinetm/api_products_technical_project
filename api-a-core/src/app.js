import 'dotenv/config';
import 'module-alias/register.js';
import { fileURLToPath } from 'url';
import path from 'path';
import moduleAlias from 'module-alias';

// Configuración de alias
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
moduleAlias.addAliases({
  '@': path.join(__dirname, '.'),
  shared: '/shared',
});

import express from 'express';
import { auth } from './middleware/auth.js';
import { connectMongo } from './utils/connect.mongo.util.js';
import { readFileSync } from 'fs';
import { createHandler } from 'graphql-http/lib/use/express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import resolvers from './graphql/resolvers.js';

const typeDefs = readFileSync(new URL('./graphql/schema.graphql', import.meta.url), 'utf8');
const schema = makeExecutableSchema({ typeDefs, resolvers });

async function main() {
  await connectMongo(process.env.MONGO_URI);
  const app = express();
  app.use(express.json());
  app.use(auth);

  app.use(
    '/graphql',
    createHandler({
      schema,
      context: ({ raw, req }) => ({ user: (req || raw).user }),
    })
  );

  app.get('/health', (_req, res) => res.json({ ok: true }));

  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`API A running on :${port}`));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
