import { Client } from '@elastic/elasticsearch';

const ELASTIC_URL = process.env.ELASTIC_URL;
if (!ELASTIC_URL) {
  throw new Error('ELASTIC_URL environment variable is not defined');
}

export const es = new Client({ node: ELASTIC_URL });
export const INDEX = 'products' as const;

async function createIndexWithSettings() {
  await es.indices.create({
    index: INDEX,
    settings: {
      number_of_shards: 1,
      analysis: {
        analyzer: {
          folding_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: ['lowercase', 'asciifolding'],
          },
        },
      },
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },
        gs1Id: { type: 'keyword' },
        name: {
          type: 'text',
          analyzer: 'folding_analyzer',
          search_analyzer: 'folding_analyzer',
        },
        brand: {
          type: 'text',
          analyzer: 'folding_analyzer',
          search_analyzer: 'folding_analyzer',
        },
        description: {
          type: 'text',
          analyzer: 'folding_analyzer',
          search_analyzer: 'folding_analyzer',
        },
        manufacturer: { type: 'text' },
        netWeight: { type: 'keyword' },
        status: { type: 'keyword' },
        updatedAt: { type: 'date' },
      },
    },
  });
}

export async function ensureIndex(): Promise<void> {
  const exists = await es.indices.exists({ index: INDEX });
  if (!exists) {
    await createIndexWithSettings();
  }
}
