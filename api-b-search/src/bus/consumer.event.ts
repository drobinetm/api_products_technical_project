import amqp from 'amqplib';
import { upsert, clearIndex } from '@/es/indexer.service.js';

export async function startConsumer(): Promise<void> {
    const url = process.env.RABBITMQ_URL as string;
    const exchange = process.env.RABBITMQ_EXCHANGE as string;
    const queue = process.env.RABBITMQ_QUEUE as string;

    const conn = await amqp.connect(url);
    const ch = await conn.createChannel();
    await ch.assertExchange(exchange, 'topic', { durable: true });
    await ch.assertQueue(queue, { durable: true });
    await ch.bindQueue(queue, exchange, 'product.*');

    ch.consume(queue, async (msg) => {
        try {
            const content = JSON.parse(msg!.content.toString());
            const routingKey = msg!.fields.routingKey;
            
            if (routingKey === 'product.cleared') {
                // Clear all products from search index
                await clearIndex();
                console.log('Cleared search index');
            } else {
                // Regular product upsert
                await upsert(content);
            }
            
            ch.ack(msg!);
        } catch (e) {
            console.error(e);
            ch.nack(msg!, false, false);
        }
    }, { noAck: false });

    console.log('Search consumer started');
}