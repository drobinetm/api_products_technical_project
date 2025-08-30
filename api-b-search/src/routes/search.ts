import { Router, Request, Response } from 'express';
import { es, INDEX } from '../es/client.js';

const router = Router();

router.get('/search', async (req: Request, res: Response) => {
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.json({ hits: [] });

    const { hits } = await es.search({
        index: INDEX,
        query: {
            multi_match: {
                query: q,
                fields: ['name^3', 'brand^2', 'description'],
                type: 'best_fields',
                operator: 'or',
                fuzziness: 'AUTO'
            }
        },
        size: 20
    });

    res.json({ hits: (hits as any).hits.map((h: any) => ({ id: h._id, score: h._score, ...h._source })) });
});

export default router;