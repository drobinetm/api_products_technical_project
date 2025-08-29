import 'dotenv/config';
import express from 'express';
import { auth } from './middleware/auth.js';
import { connectMongo } from './utils/connectMongo.js';
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

  app.use('/graphql', createHandler({
    schema,
    context: ({ raw, req }) => ({ user: (req || raw).user }),
  }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`API A running on :${port}`));
}

main().catch((e) => { console.error(e); process.exit(1); });