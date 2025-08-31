import amqp from 'amqplib';

let channel;
async function getChannel(url, exchange) {
  if (channel) return channel;
  const conn = await amqp.connect(url);
  channel = await conn.createChannel();
  await channel.assertExchange(exchange, 'topic', { durable: true });
  return channel;
}

async function publishWithRetry(ch, exchange, routingKey, msgBuf, attempt = 1) {
  const ok = ch.publish(exchange, routingKey, msgBuf, {
    contentType: 'application/json',
    persistent: true,
  });
  if (!ok) throw new Error('Channel backpressure');
}

export async function publishEvent({ url, exchange, routingKey, payload }) {
  const ch = await getChannel(url, exchange);
  const buf = Buffer.from(JSON.stringify(payload));
  try {
    await publishWithRetry(ch, exchange, routingKey, buf);
  } catch (e) {
    await new Promise(r => setTimeout(r, 500));
    await publishWithRetry(ch, exchange, routingKey, buf);
  }
}
