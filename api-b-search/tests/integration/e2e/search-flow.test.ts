import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  createMockProduct,
  createMockElasticsearchResponse,
  createMockElasticsearchClient,
  createMockRabbitMQMessage,
  createMockRabbitMQConnection,
  createMockRabbitMQChannel,
} from '../../support/test-utils.js';

// Mock dependencies
const mockElasticsearchClient = createMockElasticsearchClient();
const mockRabbitMQConnection = createMockRabbitMQConnection();
const mockRabbitMQChannel = createMockRabbitMQChannel();

vi.mock('@elastic/elasticsearch', () => ({
  Client: vi.fn(() => mockElasticsearchClient),
}));

vi.mock('@/es/client.service.js', () => ({
  es: mockElasticsearchClient,
  INDEX: 'products',
  ensureIndex: vi.fn(),
}));

vi.mock('amqplib', () => ({
  default: {
    connect: vi.fn(() => Promise.resolve(mockRabbitMQConnection)),
  },
}));

describe('End-to-End Search Flow', () => {
  let app: express.Application;
  let messageHandler: (msg: any) => Promise<void>;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup environment
    process.env.ELASTIC_URL = 'http://localhost:9200';
    process.env.RABBITMQ_URL = 'amqp://localhost:5672';
    process.env.RABBITMQ_EXCHANGE = 'test-exchange';
    process.env.RABBITMQ_QUEUE = 'test-queue';

    // Setup console spies
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup RabbitMQ mocks
    mockRabbitMQConnection.createChannel.mockResolvedValue(mockRabbitMQChannel);
    mockRabbitMQChannel.consume.mockImplementation((queue, handler) => {
      messageHandler = handler;
      return Promise.resolve();
    });

    // Setup Elasticsearch mocks
    mockElasticsearchClient.indices.exists.mockResolvedValue(false);
    mockElasticsearchClient.indices.create.mockResolvedValue({});

    // Create Express app
    app = express();
    app.use(express.json());

    // Import and setup routes
    const { default: searchRoutes } = await import('@/routes/search.js');
    app.use('/', searchRoutes);
  });

  afterEach(() => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
    vi.restoreAllMocks();
  });

  describe('Complete Search Flow', () => {
    it('should index a product via RabbitMQ and make it searchable', async () => {
      // Step 1: Start the consumer
      const { startConsumer } = await import('@/bus/consumer.event.js');
      await startConsumer();

      expect(mockRabbitMQChannel.consume).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Search consumer started');

      // Step 2: Simulate receiving a product creation message
      const newProduct = createMockProduct({
        id: 'e2e-test-123',
        name: 'E2E Test Product',
        brand: 'TestBrand',
        description: 'A product for end-to-end testing',
      });

      const productMessage = createMockRabbitMQMessage(newProduct, 'product.created');
      mockElasticsearchClient.index.mockResolvedValue({
        _id: 'e2e-test-123',
        _version: 1,
        result: 'created',
      });

      // Process the message
      await messageHandler(productMessage);

      // Verify the product was indexed
      expect(mockElasticsearchClient.index).toHaveBeenCalledWith({
        index: 'products',
        id: 'e2e-test-123',
        document: newProduct,
        refresh: 'wait_for',
      });
      expect(mockRabbitMQChannel.ack).toHaveBeenCalledWith(productMessage);

      // Step 3: Search for the product
      const searchResponse = createMockElasticsearchResponse([newProduct]);
      mockElasticsearchClient.search.mockResolvedValue(searchResponse);

      const response = await request(app).get('/search').query({ q: 'E2E Test' }).expect(200);

      // Verify search results
      expect(response.body.hits).toHaveLength(1);
      expect(response.body.hits[0]).toEqual({
        id: 'e2e-test-123',
        score: 1.0,
        gs1Id: 'GS1-123',
        name: 'E2E Test Product',
        brand: 'TestBrand',
        description: 'A product for end-to-end testing',
        manufacturer: 'Test Manufacturer',
        netWeight: '100g',
        status: 'PUBLISHED',
        updatedAt: expect.any(String),
      });

      expect(mockElasticsearchClient.search).toHaveBeenCalledWith({
        index: 'products',
        query: {
          multi_match: {
            query: 'E2E Test',
            fields: ['name^3', 'brand^2', 'description'],
            type: 'best_fields',
            operator: 'or',
            fuzziness: 'AUTO',
          },
        },
        size: 20,
      });
    });

    it('should update an existing product and reflect changes in search', async () => {
      // Start consumer
      const { startConsumer } = await import('@/bus/consumer.event.js');
      await startConsumer();

      // Updated product
      const updatedProduct = createMockProduct({
        id: 'update-test-123',
        name: 'Updated Product Name',
        brand: 'UpdatedBrand',
      });

      // Process update message
      const updateMessage = createMockRabbitMQMessage(updatedProduct, 'product.updated');
      mockElasticsearchClient.index.mockResolvedValue({
        _id: 'update-test-123',
        _version: 2,
        result: 'updated',
      });

      await messageHandler(updateMessage);

      // Verify update was indexed
      expect(mockElasticsearchClient.index).toHaveBeenCalledWith({
        index: 'products',
        id: 'update-test-123',
        document: updatedProduct,
        refresh: 'wait_for',
      });

      // Search should return updated product
      const searchResponse = createMockElasticsearchResponse([updatedProduct]);
      mockElasticsearchClient.search.mockResolvedValue(searchResponse);

      const response = await request(app)
        .get('/search')
        .query({ q: 'Updated Product' })
        .expect(200);

      expect(response.body.hits[0].name).toBe('Updated Product Name');
      expect(response.body.hits[0].brand).toBe('UpdatedBrand');
    });

    it('should clear all products and return empty search results', async () => {
      // Start consumer
      const { startConsumer } = await import('@/bus/consumer.event.js');
      await startConsumer();

      // Process clear message
      const clearMessage = createMockRabbitMQMessage({ action: 'clear_all' }, 'product.cleared');
      mockElasticsearchClient.deleteByQuery.mockResolvedValue({
        took: 30,
        deleted: 100,
        version_conflicts: 0,
        batches: 1,
      });

      await messageHandler(clearMessage);

      // Verify clear operation
      expect(mockElasticsearchClient.deleteByQuery).toHaveBeenCalledWith({
        index: 'products',
        query: { match_all: {} },
        refresh: true,
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('Cleared search index');

      // Search should return no results
      const emptySearchResponse = createMockElasticsearchResponse([]);
      mockElasticsearchClient.search.mockResolvedValue(emptySearchResponse);

      const response = await request(app).get('/search').query({ q: 'any query' }).expect(200);

      expect(response.body.hits).toHaveLength(0);
    });

    it('should handle multiple products and search with different queries', async () => {
      // Start consumer
      const { startConsumer } = await import('@/bus/consumer.event.js');
      await startConsumer();

      // Create multiple test products
      const products = [
        createMockProduct({
          id: 'phone-1',
          name: 'iPhone 15 Pro',
          brand: 'Apple',
          description: 'Latest iPhone with Pro features',
        }),
        createMockProduct({
          id: 'phone-2',
          name: 'Samsung Galaxy S24',
          brand: 'Samsung',
          description: 'Android flagship phone',
        }),
        createMockProduct({
          id: 'laptop-1',
          name: 'MacBook Pro',
          brand: 'Apple',
          description: 'Professional laptop for developers',
        }),
      ];

      // Index all products
      for (const product of products) {
        const message = createMockRabbitMQMessage(product, 'product.created');
        mockElasticsearchClient.index.mockResolvedValue({
          _id: product.id,
          _version: 1,
          result: 'created',
        });

        await messageHandler(message);
        expect(mockElasticsearchClient.index).toHaveBeenCalledWith({
          index: 'products',
          id: product.id,
          document: product,
          refresh: 'wait_for',
        });
      }

      // Test 1: Search for "Apple" should return 2 results
      const appleProducts = products.filter(p => p.brand === 'Apple');
      mockElasticsearchClient.search.mockResolvedValue(
        createMockElasticsearchResponse(appleProducts)
      );

      let response = await request(app).get('/search').query({ q: 'Apple' }).expect(200);

      expect(response.body.hits).toHaveLength(2);
      expect(response.body.hits.every((hit: any) => hit.brand === 'Apple')).toBe(true);

      // Test 2: Search for "iPhone" should return 1 result
      const iPhoneProducts = products.filter(p => p.name.includes('iPhone'));
      mockElasticsearchClient.search.mockResolvedValue(
        createMockElasticsearchResponse(iPhoneProducts)
      );

      response = await request(app).get('/search').query({ q: 'iPhone' }).expect(200);

      expect(response.body.hits).toHaveLength(1);
      expect(response.body.hits[0].name).toContain('iPhone');

      // Test 3: Search for "phone" in description should return 2 results (both phones)
      const phoneProducts = products.filter(p => p.description.toLowerCase().includes('phone'));
      mockElasticsearchClient.search.mockResolvedValue(
        createMockElasticsearchResponse(phoneProducts)
      );

      response = await request(app).get('/search').query({ q: 'phone' }).expect(200);

      expect(response.body.hits).toHaveLength(2);
      expect(
        response.body.hits.every((hit: any) => hit.description.toLowerCase().includes('phone'))
      ).toBe(true);
    });

    it('should handle errors in the flow gracefully', async () => {
      // Start consumer
      const { startConsumer } = await import('@/bus/consumer.event.js');
      await startConsumer();

      // Simulate indexing error
      const product = createMockProduct({
        id: 'error-test-123',
        name: 'Error Test Product',
      });

      const message = createMockRabbitMQMessage(product, 'product.created');
      const indexingError = new Error('Elasticsearch indexing failed');
      mockElasticsearchClient.index.mockRejectedValue(indexingError);

      // Process message - should handle error gracefully
      await messageHandler(message);

      // Verify error was logged and message was nacked
      expect(consoleErrorSpy).toHaveBeenCalledWith(indexingError);
      expect(mockRabbitMQChannel.nack).toHaveBeenCalledWith(message, false, false);
      expect(mockRabbitMQChannel.ack).not.toHaveBeenCalled();

      // Search should still work (with different product)
      const searchableProduct = createMockProduct({
        id: 'working-123',
        name: 'Working Product',
      });

      const searchResponse = createMockElasticsearchResponse([searchableProduct]);
      mockElasticsearchClient.search.mockResolvedValue(searchResponse);

      const response = await request(app).get('/search').query({ q: 'Working' }).expect(200);

      expect(response.body.hits).toHaveLength(1);
      expect(response.body.hits[0].name).toBe('Working Product');
    });

    it('should handle product approval workflow', async () => {
      // Start consumer
      const { startConsumer } = await import('@/bus/consumer.event.js');
      await startConsumer();

      // Step 1: Create pending product
      const pendingProduct = createMockProduct({
        id: 'approval-test-123',
        name: 'Pending Approval Product',
        status: 'PENDING',
      });

      const createMessage = createMockRabbitMQMessage(pendingProduct, 'product.created');
      mockElasticsearchClient.index.mockResolvedValue({
        _id: 'approval-test-123',
        _version: 1,
        result: 'created',
      });

      await messageHandler(createMessage);
      expect(mockElasticsearchClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({ status: 'PENDING' }),
        })
      );

      // Step 2: Approve the product
      const approvedProduct = createMockProduct({
        id: 'approval-test-123',
        name: 'Pending Approval Product',
        status: 'PUBLISHED',
      });

      const approvalMessage = createMockRabbitMQMessage(approvedProduct, 'product.approved');
      mockElasticsearchClient.index.mockResolvedValue({
        _id: 'approval-test-123',
        _version: 2,
        result: 'updated',
      });

      await messageHandler(approvalMessage);
      expect(mockElasticsearchClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({ status: 'PUBLISHED' }),
        })
      );

      // Step 3: Search should return published product
      const searchResponse = createMockElasticsearchResponse([approvedProduct]);
      mockElasticsearchClient.search.mockResolvedValue(searchResponse);

      const response = await request(app)
        .get('/search')
        .query({ q: 'Pending Approval' })
        .expect(200);

      expect(response.body.hits[0].status).toBe('PUBLISHED');
    });
  });

  describe('Performance and Resilience', () => {
    it('should handle concurrent message processing', async () => {
      const { startConsumer } = await import('@/bus/consumer.event.js');
      await startConsumer();

      // Create multiple products for concurrent processing
      const products = Array.from({ length: 10 }, (_, i) =>
        createMockProduct({
          id: `concurrent-${i}`,
          name: `Concurrent Product ${i}`,
        })
      );

      const messages = products.map(product =>
        createMockRabbitMQMessage(product, 'product.created')
      );

      // Mock successful indexing for all products
      mockElasticsearchClient.index.mockResolvedValue({
        _version: 1,
        result: 'created',
      });

      // Process all messages concurrently
      await Promise.all(messages.map(message => messageHandler(message)));

      // Verify all products were indexed
      expect(mockElasticsearchClient.index).toHaveBeenCalledTimes(10);
      expect(mockRabbitMQChannel.ack).toHaveBeenCalledTimes(10);
    });

    it('should handle partial failures in batch operations', async () => {
      const { startConsumer } = await import('@/bus/consumer.event.js');
      await startConsumer();

      const products = [
        createMockProduct({ id: 'success-1', name: 'Success Product 1' }),
        createMockProduct({ id: 'fail-1', name: 'Fail Product 1' }),
        createMockProduct({ id: 'success-2', name: 'Success Product 2' }),
      ];

      // Mock: first call succeeds, second fails, third succeeds
      mockElasticsearchClient.index
        .mockResolvedValueOnce({ result: 'created' })
        .mockRejectedValueOnce(new Error('Indexing failed'))
        .mockResolvedValueOnce({ result: 'created' });

      // Process messages sequentially
      for (let i = 0; i < products.length; i++) {
        const message = createMockRabbitMQMessage(products[i], 'product.created');
        await messageHandler(message);
      }

      // Verify: 2 acks, 1 nack
      expect(mockRabbitMQChannel.ack).toHaveBeenCalledTimes(2);
      expect(mockRabbitMQChannel.nack).toHaveBeenCalledTimes(1);
    });
  });
});
