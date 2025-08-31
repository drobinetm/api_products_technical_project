import { Router, Request, Response } from 'express';
import { es, INDEX } from '@/es/client.service.js';

const router = Router();

router.get('/search', async (req: Request, res: Response) => {
    try {
        const q = String(req.query.q ?? '').trim();
        if (!q) return res.json({ hits: [] });

        const response = await es.search({
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

        // Check if response has the expected structure
        if (!response.hits || !response.hits.hits) {
            throw new Error('Malformed Elasticsearch response');
        }

        res.json({ 
            hits: response.hits.hits.map((h: any) => ({ 
                id: h._id, 
                score: h._score, 
                ...h._source 
            })) 
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).send(error instanceof Error ? error.message : 'Internal server error');
    }
});

export default router;