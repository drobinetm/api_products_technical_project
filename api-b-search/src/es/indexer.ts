import { es, INDEX } from './client.js';

export async function upsert(doc: Record<string, unknown>): Promise<void> {
    await es.index({ index: INDEX, id: String((doc as any).id), document: doc, refresh: 'wait_for' });
}