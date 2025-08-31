import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockProduct, createMockElasticsearchClient } from '../../support/test-utils.js';

// Mock the client service
const mockClient = createMockElasticsearchClient();
vi.mock('@/es/client.service.js', () => ({
  es: mockClient,
  INDEX: 'products',
}));

describe('Indexer Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('upsert function', () => {
    it('should index a document with correct parameters', async () => {
      const mockProduct = createMockProduct({
        id: 'test-123',
        name: 'Test Product',
        brand: 'Test Brand'
      });

      mockClient.index.mockResolvedValue({
        _id: 'test-123',
        _version: 1,
        result: 'created'
      });

      const { upsert } = await import('@/es/indexer.service.js');
      
      await upsert(mockProduct);

      expect(mockClient.index).toHaveBeenCalledWith({
        index: 'products',
        id: 'test-123',
        document: mockProduct,
        refresh: 'wait_for'
      });
    });

    it('should handle products with different ID types', async () => {
      const mockProduct = createMockProduct({
        id: 123, // numeric ID
        name: 'Numeric ID Product'
      });

      mockClient.index.mockResolvedValue({
        _id: '123',
        _version: 1,
        result: 'created'
      });

      const { upsert } = await import('@/es/indexer.service.js');
      
      await upsert(mockProduct);

      expect(mockClient.index).toHaveBeenCalledWith({
        index: 'products',
        id: '123', // Should be converted to string
        document: mockProduct,
        refresh: 'wait_for'
      });
    });

    it('should handle nested object properties', async () => {
      const mockProduct = createMockProduct({
        id: 'nested-123',
        metadata: {
          category: 'electronics',
          tags: ['smartphone', 'mobile']
        }
      });

      mockClient.index.mockResolvedValue({
        _id: 'nested-123',
        _version: 1,
        result: 'created'
      });

      const { upsert } = await import('@/es/indexer.service.js');
      
      await upsert(mockProduct);

      expect(mockClient.index).toHaveBeenCalledWith({
        index: 'products',
        id: 'nested-123',
        document: mockProduct,
        refresh: 'wait_for'
      });
    });

    it('should handle upsert updates (existing documents)', async () => {
      const mockProduct = createMockProduct({
        id: 'existing-123',
        name: 'Updated Product Name'
      });

      mockClient.index.mockResolvedValue({
        _id: 'existing-123',
        _version: 2,
        result: 'updated'
      });

      const { upsert } = await import('@/es/indexer.service.js');
      
      await upsert(mockProduct);

      expect(mockClient.index).toHaveBeenCalledWith({
        index: 'products',
        id: 'existing-123',
        document: mockProduct,
        refresh: 'wait_for'
      });
    });

    it('should handle indexing errors', async () => {
      const mockProduct = createMockProduct({
        id: 'error-123'
      });

      const indexError = new Error('Index operation failed');
      mockClient.index.mockRejectedValue(indexError);

      const { upsert } = await import('@/es/indexer.service.js');
      
      await expect(upsert(mockProduct)).rejects.toThrow('Index operation failed');
    });

    it('should handle Elasticsearch connection errors', async () => {
      const mockProduct = createMockProduct({
        id: 'connection-error-123'
      });

      const connectionError = new Error('Connection timeout');
      connectionError.name = 'ConnectionError';
      mockClient.index.mockRejectedValue(connectionError);

      const { upsert } = await import('@/es/indexer.service.js');
      
      await expect(upsert(mockProduct)).rejects.toThrow('Connection timeout');
    });

    it('should handle malformed documents gracefully', async () => {
      const malformedDoc = {
        // Missing required 'id' field
        name: 'Product without ID'
      };

      // This should still attempt to index, but will use undefined/null as ID
      mockClient.index.mockResolvedValue({
        _id: 'null',
        _version: 1,
        result: 'created'
      });

      const { upsert } = await import('@/es/indexer.service.js');
      
      await upsert(malformedDoc);

      expect(mockClient.index).toHaveBeenCalledWith({
        index: 'products',
        id: 'undefined', // String conversion of undefined
        document: malformedDoc,
        refresh: 'wait_for'
      });
    });

    it('should use wait_for refresh policy', async () => {
      const mockProduct = createMockProduct();
      mockClient.index.mockResolvedValue({});

      const { upsert } = await import('@/es/indexer.service.js');
      
      await upsert(mockProduct);

      expect(mockClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          refresh: 'wait_for'
        })
      );
    });
  });

  describe('clearIndex function', () => {
    it('should delete all documents from index', async () => {
      mockClient.deleteByQuery.mockResolvedValue({
        took: 30,
        timed_out: false,
        total: 100,
        deleted: 100,
        batches: 1,
        version_conflicts: 0,
        noops: 0,
        retries: {
          bulk: 0,
          search: 0
        },
        throttled_millis: 0,
        requests_per_second: -1,
        throttled_until_millis: 0,
        failures: []
      });

      const { clearIndex } = await import('@/es/indexer.service.js');
      
      await clearIndex();

      expect(mockClient.deleteByQuery).toHaveBeenCalledWith({
        index: 'products',
        query: { match_all: {} },
        refresh: true
      });
    });

    it('should handle empty index gracefully', async () => {
      mockClient.deleteByQuery.mockResolvedValue({
        took: 5,
        timed_out: false,
        total: 0,
        deleted: 0,
        batches: 1,
        version_conflicts: 0,
        noops: 0,
        retries: {
          bulk: 0,
          search: 0
        },
        throttled_millis: 0,
        requests_per_second: -1,
        throttled_until_millis: 0,
        failures: []
      });

      const { clearIndex } = await import('@/es/indexer.service.js');
      
      await expect(clearIndex()).resolves.not.toThrow();
      expect(mockClient.deleteByQuery).toHaveBeenCalled();
    });

    it('should handle clear index errors', async () => {
      const clearError = new Error('Delete operation failed');
      mockClient.deleteByQuery.mockRejectedValue(clearError);

      const { clearIndex } = await import('@/es/indexer.service.js');
      
      await expect(clearIndex()).rejects.toThrow('Delete operation failed');
    });

    it('should use refresh=true for immediate availability', async () => {
      mockClient.deleteByQuery.mockResolvedValue({});

      const { clearIndex } = await import('@/es/indexer.service.js');
      
      await clearIndex();

      expect(mockClient.deleteByQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          refresh: true
        })
      );
    });

    it('should handle index not found error', async () => {
      const notFoundError = new Error('index_not_found_exception');
      notFoundError.name = 'ResponseError';
      mockClient.deleteByQuery.mockRejectedValue(notFoundError);

      const { clearIndex } = await import('@/es/indexer.service.js');
      
      await expect(clearIndex()).rejects.toThrow('index_not_found_exception');
    });

    it('should use match_all query to delete all documents', async () => {
      mockClient.deleteByQuery.mockResolvedValue({});

      const { clearIndex } = await import('@/es/indexer.service.js');
      
      await clearIndex();

      expect(mockClient.deleteByQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: { match_all: {} }
        })
      );
    });
  });

  describe('Error resilience', () => {
    it('should handle temporary network failures', async () => {
      const mockProduct = createMockProduct();
      const networkError = new Error('ECONNRESET');
      networkError.name = 'ConnectionError';
      
      mockClient.index.mockRejectedValue(networkError);

      const { upsert } = await import('@/es/indexer.service.js');
      
      await expect(upsert(mockProduct)).rejects.toThrow('ECONNRESET');
    });

    it('should handle Elasticsearch cluster errors', async () => {
      const clusterError = new Error('cluster_block_exception');
      clusterError.name = 'ResponseError';
      
      mockClient.deleteByQuery.mockRejectedValue(clusterError);

      const { clearIndex } = await import('@/es/indexer.service.js');
      
      await expect(clearIndex()).rejects.toThrow('cluster_block_exception');
    });
  });
});
