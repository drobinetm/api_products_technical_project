import { vi } from 'vitest';

// Test data factories
export const createMockProduct = (overrides: Partial<any> = {}) => ({
  id: '123',
  gs1Id: 'GS1-123',
  name: 'Test Product',
  brand: 'Test Brand',
  description: 'A test product description',
  manufacturer: 'Test Manufacturer',
  netWeight: '100g',
  status: 'PUBLISHED',
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockElasticsearchHit = (product: any, score = 1.0) => ({
  _id: product.id,
  _score: score,
  _source: product,
});

export const createMockElasticsearchResponse = (products: any[], total = products.length) => ({
  hits: {
    total: { value: total, relation: 'eq' },
    hits: products.map((product, index) => createMockElasticsearchHit(product, 1.0 - index * 0.1)),
  },
});

// Mock RabbitMQ message
export const createMockRabbitMQMessage = (content: any, routingKey = 'product.created') => ({
  content: Buffer.from(JSON.stringify(content)),
  fields: { routingKey },
  properties: {},
});

// Mock Elasticsearch client
export const createMockElasticsearchClient = () => ({
  indices: {
    exists: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  index: vi.fn(),
  search: vi.fn(),
  deleteByQuery: vi.fn(),
  ping: vi.fn(),
});

// Mock RabbitMQ connection and channel
export const createMockRabbitMQChannel = () => ({
  assertExchange: vi.fn(),
  assertQueue: vi.fn(),
  bindQueue: vi.fn(),
  consume: vi.fn(),
  ack: vi.fn(),
  nack: vi.fn(),
  publish: vi.fn(),
  close: vi.fn(),
});

export const createMockRabbitMQConnection = () => ({
  createChannel: vi.fn(),
  close: vi.fn(),
});

// Test helpers
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const expectToThrow = async (fn: () => Promise<any> | any, errorMessage?: string) => {
  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (error: any) {
    if (errorMessage) {
      expect(error.message).toContain(errorMessage);
    }
    return error;
  }
};
