import { es, INDEX } from '@/es/client.service.js';

export async function upsert(doc: Record<string, unknown>): Promise<void> {
    await es.index({ index: INDEX, id: String((doc as any).id), document: doc, refresh: 'wait_for' });
}

export async function clearIndex(): Promise<void> {
    await es.deleteByQuery({
        index: INDEX,
        query: { match_all: {} },
        refresh: true
    });
}
