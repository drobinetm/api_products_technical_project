import { Client } from '@elastic/elasticsearch';
export const es = new Client({ node: process.env.ELASTIC_URL as string });
export const INDEX = 'products' as const;

export async function ensureIndex(): Promise<void> {
    const exists = await es.indices.exists({ index: INDEX });
    if (!exists) {
        await es.indices.create({
            index: INDEX,
            settings: { number_of_shards: 1 },
            mappings: {
                properties: {
                    id: { type: 'keyword' },
                    gs1Id: { type: 'keyword' },
                    name: { type: 'text' },
                    brand: { type: 'text' },
                    description: { type: 'text' },
                    manufacturer: { type: 'text' },
                    netWeight: { type: 'keyword' },
                    status: { type: 'keyword' },
                    updatedAt: { type: 'date' }
                }
            }
        });
    }
}