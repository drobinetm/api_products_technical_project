import 'dotenv/config';
import express from 'express';
import searchRoutes from './routes/search';
import { ensureIndex } from './es/client';
import { startConsumer } from './bus/consumer';

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