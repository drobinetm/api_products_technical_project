import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { Client } from '@elastic/elasticsearch';
import { createMockElasticsearchClient } from '../../support/test-utils.js';

// Mock the Elasticsearch client
vi.mock('@elastic/elasticsearch', () => ({
  Client: vi.fn(),
}));

// Mock environment variables
const originalEnv = process.env;

describe('Elasticsearch Client Service', () => {
  let mockClient: ReturnType<typeof createMockElasticsearchClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockElasticsearchClient();
    (Client as Mock).mockImplementation(() => mockClient);

    // Reset environment variables
    process.env = { ...originalEnv };
    process.env.ELASTIC_URL = 'http://localhost:9200';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Client initialization', () => {
    it('should initialize Elasticsearch client with correct URL', async () => {
      process.env.ELASTIC_URL = 'http://test.elasticsearch.com:9200';

      // Import the module after setting up mocks and env vars
      const { es } = await import('@/es/client.service.js');

      expect(Client).toHaveBeenCalledWith({
        node: 'http://test.elasticsearch.com:9200',
      });
      expect(es).toBeDefined();
    });

    it('should throw error when ELASTIC_URL is not defined', async () => {
      // Clear modules first, then set environment
      vi.resetModules();
      delete process.env.ELASTIC_URL;

      await expect(async () => {
        await import('@/es/client.service.js');
      }).rejects.toThrow('ELASTIC_URL environment variable is not defined');
    });

    it('should export INDEX constant', async () => {
      // Ensure environment is properly set for this test
      process.env.ELASTIC_URL = 'http://localhost:9200';
      vi.resetModules();

      const { INDEX } = await import('@/es/client.service.js');
      expect(INDEX).toBe('products');
    });
  });

  describe('ensureIndex function', () => {
    beforeEach(() => {
      // Clear module cache to ensure fresh imports
      vi.resetModules();
    });

    it('should create index when it does not exist', async () => {
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockResolvedValue({});

      const { ensureIndex } = await import('@/es/client.service.js');

      await ensureIndex();

      expect(mockClient.indices.exists).toHaveBeenCalledWith({ index: 'products' });
      expect(mockClient.indices.create).toHaveBeenCalledWith({
        index: 'products',
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
    });

    it('should not create index when it already exists', async () => {
      mockClient.indices.exists.mockResolvedValue(true);

      const { ensureIndex } = await import('@/es/client.service.js');

      await ensureIndex();

      expect(mockClient.indices.exists).toHaveBeenCalledWith({ index: 'products' });
      expect(mockClient.indices.create).not.toHaveBeenCalled();
    });

    it('should handle errors when checking index existence', async () => {
      const error = new Error('Connection failed');
      mockClient.indices.exists.mockRejectedValue(error);

      const { ensureIndex } = await import('@/es/client.service.js');

      await expect(ensureIndex()).rejects.toThrow('Connection failed');
      expect(mockClient.indices.create).not.toHaveBeenCalled();
    });

    it('should handle errors when creating index', async () => {
      mockClient.indices.exists.mockResolvedValue(false);
      const error = new Error('Index creation failed');
      mockClient.indices.create.mockRejectedValue(error);

      const { ensureIndex } = await import('@/es/client.service.js');

      await expect(ensureIndex()).rejects.toThrow('Index creation failed');
    });

    it('should create index with correct analyzer settings', async () => {
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockResolvedValue({});

      const { ensureIndex } = await import('@/es/client.service.js');

      await ensureIndex();

      const createCall = mockClient.indices.create.mock.calls[0][0];
      expect(createCall.settings.analysis.analyzer.folding_analyzer).toEqual({
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase', 'asciifolding'],
      });
    });

    it('should create index with correct field mappings', async () => {
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockResolvedValue({});

      const { ensureIndex } = await import('@/es/client.service.js');

      await ensureIndex();

      const createCall = mockClient.indices.create.mock.calls[0][0];
      const mappings = createCall.mappings.properties;

      expect(mappings.id).toEqual({ type: 'keyword' });
      expect(mappings.gs1Id).toEqual({ type: 'keyword' });
      expect(mappings.name).toEqual({
        type: 'text',
        analyzer: 'folding_analyzer',
        search_analyzer: 'folding_analyzer',
      });
      expect(mappings.brand).toEqual({
        type: 'text',
        analyzer: 'folding_analyzer',
        search_analyzer: 'folding_analyzer',
      });
      expect(mappings.status).toEqual({ type: 'keyword' });
      expect(mappings.updatedAt).toEqual({ type: 'date' });
    });
  });

  describe('Error scenarios', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network timeout');
      mockClient.indices.exists.mockRejectedValue(networkError);

      const { ensureIndex } = await import('@/es/client.service.js');

      await expect(ensureIndex()).rejects.toThrow('Network timeout');
    });

    it('should handle Elasticsearch service errors', async () => {
      const serviceError = new Error('Service unavailable');
      serviceError.name = 'ConnectionError';
      mockClient.indices.exists.mockRejectedValue(serviceError);

      const { ensureIndex } = await import('@/es/client.service.js');

      await expect(ensureIndex()).rejects.toThrow('Service unavailable');
    });
  });
});
