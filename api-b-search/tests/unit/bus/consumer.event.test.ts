import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { 
  createMockProduct, 
  createMockRabbitMQMessage,
  createMockRabbitMQConnection,
  createMockRabbitMQChannel
} from '../../support/test-utils.js';

// Mock amqplib
const mockConnection = createMockRabbitMQConnection();
const mockChannel = createMockRabbitMQChannel();

vi.mock('amqplib', () => ({
  default: {
    connect: vi.fn(),
  },
}));

// Mock indexer service
const mockUpsert = vi.fn();
const mockClearIndex = vi.fn();
vi.mock('@/es/indexer.service.js', () => ({
  upsert: mockUpsert,
  clearIndex: mockClearIndex,
}));

// Setup environment variables
const originalEnv = process.env;

describe('RabbitMQ Consumer', () => {
  let amqp: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset environment
    process.env = { ...originalEnv };
    process.env.RABBITMQ_URL = 'amqp://localhost:5672';
    process.env.RABBITMQ_EXCHANGE = 'test-exchange';
    process.env.RABBITMQ_QUEUE = 'test-queue';

    // Setup mocks
    mockConnection.createChannel.mockResolvedValue(mockChannel);
    
    const { default: amqpDefault } = await import('amqplib');
    amqp = amqpDefault;
    (amqp.connect as Mock).mockResolvedValue(mockConnection);

    // Setup console spies
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
  });

  describe('startConsumer function', () => {
    it('should establish connection and setup consumer correctly', async () => {
      const { startConsumer } = await import('@/bus/consumer.event.js');
      
      await startConsumer();

      expect(amqp.connect).toHaveBeenCalledWith('amqp://localhost:5672');
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith('test-exchange', 'topic', { durable: true });
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('test-queue', { durable: true });
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('test-queue', 'test-exchange', 'product.*');
      expect(mockChannel.consume).toHaveBeenCalledWith('test-queue', expect.any(Function), { noAck: false });
      expect(consoleLogSpy).toHaveBeenCalledWith('Search consumer started');
    });

    it('should handle connection errors', async () => {
      const connectionError = new Error('Connection failed');
      (amqp.connect as Mock).mockRejectedValue(connectionError);

      const { startConsumer } = await import('@/bus/consumer.event.js');
      
      await expect(startConsumer()).rejects.toThrow('Connection failed');
    });

    it('should handle channel creation errors', async () => {
      const channelError = new Error('Channel creation failed');
      mockConnection.createChannel.mockRejectedValue(channelError);

      const { startConsumer } = await import('@/bus/consumer.event.js');
      
      await expect(startConsumer()).rejects.toThrow('Channel creation failed');
    });

    it('should handle exchange assertion errors', async () => {
      const exchangeError = new Error('Exchange assertion failed');
      mockChannel.assertExchange.mockRejectedValue(exchangeError);

      const { startConsumer } = await import('@/bus/consumer.event.js');
      
      await expect(startConsumer()).rejects.toThrow('Exchange assertion failed');
    });
  });

  describe('Message processing', () => {
    let messageHandler: (msg: any) => Promise<void>;

    beforeEach(async () => {
      mockChannel.consume.mockImplementation((queue, handler) => {
        messageHandler = handler;
        return Promise.resolve();
      });

      const { startConsumer } = await import('@/bus/consumer.event.js');
      await startConsumer();
    });

    it('should process regular product messages and call upsert', async () => {
      const mockProduct = createMockProduct({
        id: 'test-product-123',
        name: 'Test Product for Upsert'
      });
      
      const message = createMockRabbitMQMessage(mockProduct, 'product.created');
      mockUpsert.mockResolvedValue(undefined);

      await messageHandler(message);

      expect(mockUpsert).toHaveBeenCalledWith(mockProduct);
      expect(mockClearIndex).not.toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(message);
    });

    it('should process product.updated messages', async () => {
      const mockProduct = createMockProduct({
        id: 'updated-product-123',
        name: 'Updated Product Name'
      });
      
      const message = createMockRabbitMQMessage(mockProduct, 'product.updated');
      mockUpsert.mockResolvedValue(undefined);

      await messageHandler(message);

      expect(mockUpsert).toHaveBeenCalledWith(mockProduct);
      expect(mockChannel.ack).toHaveBeenCalledWith(message);
    });

    it('should process product.approved messages', async () => {
      const mockProduct = createMockProduct({
        id: 'approved-product-123',
        status: 'PUBLISHED'
      });
      
      const message = createMockRabbitMQMessage(mockProduct, 'product.approved');
      mockUpsert.mockResolvedValue(undefined);

      await messageHandler(message);

      expect(mockUpsert).toHaveBeenCalledWith(mockProduct);
      expect(mockChannel.ack).toHaveBeenCalledWith(message);
    });

    it('should process product.cleared messages and call clearIndex', async () => {
      const clearMessage = createMockRabbitMQMessage({ action: 'clear_all' }, 'product.cleared');
      mockClearIndex.mockResolvedValue(undefined);

      await messageHandler(clearMessage);

      expect(mockClearIndex).toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(clearMessage);
      expect(consoleLogSpy).toHaveBeenCalledWith('Cleared search index');
    });

    it('should handle malformed JSON messages', async () => {
      const malformedMessage = {
        content: Buffer.from('invalid json {'),
        fields: { routingKey: 'product.created' },
        properties: {}
      };

      await messageHandler(malformedMessage);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockChannel.nack).toHaveBeenCalledWith(malformedMessage, false, false);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it('should handle upsert errors and nack message', async () => {
      const mockProduct = createMockProduct();
      const message = createMockRabbitMQMessage(mockProduct, 'product.created');
      
      const upsertError = new Error('Upsert failed');
      mockUpsert.mockRejectedValue(upsertError);

      await messageHandler(message);

      expect(mockUpsert).toHaveBeenCalledWith(mockProduct);
      expect(consoleErrorSpy).toHaveBeenCalledWith(upsertError);
      expect(mockChannel.nack).toHaveBeenCalledWith(message, false, false);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it('should handle clearIndex errors and nack message', async () => {
      const clearMessage = createMockRabbitMQMessage({ action: 'clear_all' }, 'product.cleared');
      
      const clearError = new Error('Clear index failed');
      mockClearIndex.mockRejectedValue(clearError);

      await messageHandler(clearMessage);

      expect(mockClearIndex).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(clearError);
      expect(mockChannel.nack).toHaveBeenCalledWith(clearMessage, false, false);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it('should handle null messages gracefully', async () => {
      const nullMessage = null;

      // This should cause an error when trying to access properties
      await messageHandler(nullMessage);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockChannel.nack).toHaveBeenCalledWith(nullMessage, false, false);
    });

    it('should handle empty message content', async () => {
      const emptyMessage = {
        content: Buffer.from(''),
        fields: { routingKey: 'product.created' },
        properties: {}
      };

      await messageHandler(emptyMessage);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockChannel.nack).toHaveBeenCalledWith(emptyMessage, false, false);
    });

    it('should handle unknown routing keys as regular upsert', async () => {
      const mockProduct = createMockProduct();
      const message = createMockRabbitMQMessage(mockProduct, 'product.unknown');
      mockUpsert.mockResolvedValue(undefined);

      await messageHandler(message);

      expect(mockUpsert).toHaveBeenCalledWith(mockProduct);
      expect(mockClearIndex).not.toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(message);
    });

    it('should handle messages with missing routing key', async () => {
      const mockProduct = createMockProduct();
      const messageWithoutRoutingKey = {
        content: Buffer.from(JSON.stringify(mockProduct)),
        fields: {}, // No routing key
        properties: {}
      };
      mockUpsert.mockResolvedValue(undefined);

      await messageHandler(messageWithoutRoutingKey);

      // Should default to upsert behavior
      expect(mockUpsert).toHaveBeenCalledWith(mockProduct);
      expect(mockChannel.ack).toHaveBeenCalledWith(messageWithoutRoutingKey);
    });
  });

  describe('Message acknowledgment', () => {
    let messageHandler: (msg: any) => Promise<void>;

    beforeEach(async () => {
      mockChannel.consume.mockImplementation((queue, handler) => {
        messageHandler = handler;
        return Promise.resolve();
      });

      const { startConsumer } = await import('@/bus/consumer.event.js');
      await startConsumer();
    });

    it('should acknowledge successful message processing', async () => {
      const mockProduct = createMockProduct();
      const message = createMockRabbitMQMessage(mockProduct, 'product.created');
      mockUpsert.mockResolvedValue(undefined);

      await messageHandler(message);

      expect(mockChannel.ack).toHaveBeenCalledWith(message);
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it('should not acknowledge failed message processing', async () => {
      const mockProduct = createMockProduct();
      const message = createMockRabbitMQMessage(mockProduct, 'product.created');
      
      const processingError = new Error('Processing failed');
      mockUpsert.mockRejectedValue(processingError);

      await messageHandler(message);

      expect(mockChannel.nack).toHaveBeenCalledWith(message, false, false);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it('should use correct nack parameters (no requeue)', async () => {
      const mockProduct = createMockProduct();
      const message = createMockRabbitMQMessage(mockProduct, 'product.created');
      
      mockUpsert.mockRejectedValue(new Error('Test error'));

      await messageHandler(message);

      // Should nack with requeue=false (no requeue)
      expect(mockChannel.nack).toHaveBeenCalledWith(message, false, false);
    });
  });

  describe('Environment configuration', () => {
    it('should use environment variables for connection settings', async () => {
      process.env.RABBITMQ_URL = 'amqp://custom-host:5672';
      process.env.RABBITMQ_EXCHANGE = 'custom-exchange';
      process.env.RABBITMQ_QUEUE = 'custom-queue';

      const { startConsumer } = await import('@/bus/consumer.event.js');
      await startConsumer();

      expect(amqp.connect).toHaveBeenCalledWith('amqp://custom-host:5672');
      expect(mockChannel.assertExchange).toHaveBeenCalledWith('custom-exchange', 'topic', { durable: true });
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('custom-queue', { durable: true });
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('custom-queue', 'custom-exchange', 'product.*');
    });
  });
});
