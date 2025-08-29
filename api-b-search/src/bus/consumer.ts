import amqp from 'amqplib';
import { upsert } from '../es/indexer';

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
            await upsert(content);
            ch.ack(msg!);
        } catch (e) {
            console.error(e);
            ch.nack(msg!, false, false);
        }
    }, { noAck: false });

    console.log('Search consumer started');
}