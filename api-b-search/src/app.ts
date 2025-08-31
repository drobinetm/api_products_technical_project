import 'dotenv/config';
import 'module-alias/register.js';
import { fileURLToPath } from 'url';
import path from 'path';
import moduleAlias from 'module-alias';

// Configuración de alias
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
moduleAlias.addAliases({
  '@': path.join(__dirname, '.')
});

import express from 'express';
import searchRoutes from './routes/search.js';
import { ensureIndex } from './es/client.service.js';
import { startConsumer } from './bus/consumer.event.js';

async function main() {
    const app = express();
    app.use(express.json());
    await ensureIndex();
    startConsumer();

    app.use('/', searchRoutes);
    app.get('/health', (_req, res) => res.json({ ok: true }));

    const port = Number(process.env.PORT) || 3001;
    app.listen(port, () => console.log(`API B running on :${port}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
export {};