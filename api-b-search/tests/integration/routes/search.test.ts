import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { 
  createMockProduct, 
  createMockElasticsearchResponse,
  createMockElasticsearchClient 
} from '../../support/test-utils.js';

// Mock the Elasticsearch client service
const mockClient = createMockElasticsearchClient();
vi.mock('@/es/client.service.js', () => ({
  es: mockClient,
  INDEX: 'products',
}));

describe('Search Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Import and use search routes
    const { default: searchRoutes } = await import('@/routes/search.js');
    app.use('/', searchRoutes);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /search', () => {
    it('should return search results for valid query', async () => {
      const mockProducts = [
        createMockProduct({
          id: '1',
          name: 'iPhone 15 Pro',
          brand: 'Apple',
          description: 'Latest iPhone model'
        }),
        createMockProduct({
          id: '2',
          name: 'iPhone 15',
          brand: 'Apple',
          description: 'Standard iPhone model'
        })
      ];

      const mockResponse = createMockElasticsearchResponse(mockProducts);
      mockClient.search.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/search')
        .query({ q: 'iPhone' })
        .expect(200);

      expect(response.body.hits).toHaveLength(2);
      expect(response.body.hits[0]).toEqual({
        id: '1',
        score: 1.0,
        gs1Id: 'GS1-123',
        name: 'iPhone 15 Pro',
        brand: 'Apple',
        description: 'Latest iPhone model',
        manufacturer: 'Test Manufacturer',
        netWeight: '100g',
        status: 'PUBLISHED',
        updatedAt: expect.any(String)
      });

      expect(mockClient.search).toHaveBeenCalledWith({
        index: 'products',
        query: {
          multi_match: {
            query: 'iPhone',
            fields: ['name^3', 'brand^2', 'description'],
            type: 'best_fields',
            operator: 'or',
            fuzziness: 'AUTO'
          }
        },
        size: 20
      });
    });

    it('should return empty results for no query', async () => {
      const response = await request(app)
        .get('/search')
        .expect(200);

      expect(response.body).toEqual({ hits: [] });
      expect(mockClient.search).not.toHaveBeenCalled();
    });

    it('should return empty results for empty query string', async () => {
      const response = await request(app)
        .get('/search')
        .query({ q: '' })
        .expect(200);

      expect(response.body).toEqual({ hits: [] });
      expect(mockClient.search).not.toHaveBeenCalled();
    });

    it('should return empty results for whitespace-only query', async () => {
      const response = await request(app)
        .get('/search')
        .query({ q: '   ' })
        .expect(200);

      expect(response.body).toEqual({ hits: [] });
      expect(mockClient.search).not.toHaveBeenCalled();
    });

    it('should handle special characters in search query', async () => {
      const mockProducts = [createMockProduct({ name: 'C++ Programming Guide' })];
      const mockResponse = createMockElasticsearchResponse(mockProducts);
      mockClient.search.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/search')
        .query({ q: 'C++' })
        .expect(200);

      expect(response.body.hits).toHaveLength(1);
      expect(mockClient.search).toHaveBeenCalledWith({
        index: 'products',
        query: {
          multi_match: {
            query: 'C++',
            fields: ['name^3', 'brand^2', 'description'],
            type: 'best_fields',
            operator: 'or',
            fuzziness: 'AUTO'
          }
        },
        size: 20
      });
    });

    it('should handle Unicode characters in search query', async () => {
      const mockProducts = [createMockProduct({ name: 'Café Français' })];
      const mockResponse = createMockElasticsearchResponse(mockProducts);
      mockClient.search.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/search')
        .query({ q: 'café' })
        .expect(200);

      expect(response.body.hits).toHaveLength(1);
      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            multi_match: expect.objectContaining({
              query: 'café'
            })
          })
        })
      );
    });

    it('should handle numeric search queries', async () => {
      const mockProducts = [createMockProduct({ name: 'Product 123' })];
      const mockResponse = createMockElasticsearchResponse(mockProducts);
      mockClient.search.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/search')
        .query({ q: '123' })
        .expect(200);

      expect(response.body.hits).toHaveLength(1);
      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            multi_match: expect.objectContaining({
              query: '123'
            })
          })
        })
      );
    });

    it('should use correct field boosting in search query', async () => {
      mockClient.search.mockResolvedValue(createMockElasticsearchResponse([]));

      await request(app)
        .get('/search')
        .query({ q: 'test' })
        .expect(200);

      expect(mockClient.search).toHaveBeenCalledWith({
        index: 'products',
        query: {
          multi_match: {
            query: 'test',
            fields: ['name^3', 'brand^2', 'description'],
            type: 'best_fields',
            operator: 'or',
            fuzziness: 'AUTO'
          }
        },
        size: 20
      });
    });

    it('should limit results to 20 items', async () => {
      const mockProducts = Array.from({ length: 25 }, (_, i) => 
        createMockProduct({ id: `${i + 1}`, name: `Product ${i + 1}` })
      );
      const mockResponse = createMockElasticsearchResponse(mockProducts);
      mockClient.search.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/search')
        .query({ q: 'Product' })
        .expect(200);

      expect(response.body.hits).toHaveLength(25); // Mock returns all, but query limits to 20
      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 20
        })
      );
    });

    it('should format response correctly with score and id', async () => {
      const mockProduct = createMockProduct({
        id: 'test-123',
        name: 'Test Product'
      });
      const mockResponse = createMockElasticsearchResponse([mockProduct]);
      mockClient.search.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/search')
        .query({ q: 'Test' })
        .expect(200);

      expect(response.body.hits[0]).toEqual({
        id: 'test-123',
        score: 1.0,
        gs1Id: 'GS1-123',
        name: 'Test Product',
        brand: 'Test Brand',
        description: 'A test product description',
        manufacturer: 'Test Manufacturer',
        netWeight: '100g',
        status: 'PUBLISHED',
        updatedAt: expect.any(String)
      });
    });

    it('should handle empty hits array', async () => {
      const emptyResponse = createMockElasticsearchResponse([]);
      mockClient.search.mockResolvedValue(emptyResponse);

      const response = await request(app)
        .get('/search')
        .query({ q: 'nonexistent' })
        .expect(200);

      expect(response.body.hits).toHaveLength(0);
      expect(response.body.hits).toEqual([]);
    });

    it('should handle very long search queries', async () => {
      const longQuery = 'a'.repeat(1000);
      const mockResponse = createMockElasticsearchResponse([]);
      mockClient.search.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/search')
        .query({ q: longQuery })
        .expect(200);

      expect(response.body.hits).toEqual([]);
      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            multi_match: expect.objectContaining({
              query: longQuery
            })
          })
        })
      );
    });

    it('should preserve product metadata in search results', async () => {
      const mockProduct = createMockProduct({
        id: 'meta-test',
        name: 'Product with Metadata',
        brand: 'Brand X',
        manufacturer: 'Manufacturer Y',
        netWeight: '250g',
        status: 'PUBLISHED'
      });
      const mockResponse = createMockElasticsearchResponse([mockProduct]);
      mockClient.search.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/search')
        .query({ q: 'metadata' })
        .expect(200);

      const result = response.body.hits[0];
      expect(result.brand).toBe('Brand X');
      expect(result.manufacturer).toBe('Manufacturer Y');
      expect(result.netWeight).toBe('250g');
      expect(result.status).toBe('PUBLISHED');
    });

    it('should handle products with missing optional fields', async () => {
      const mockProduct = {
        id: 'minimal-product',
        name: 'Minimal Product',
        // Missing optional fields like brand, description, etc.
      };
      const mockResponse = createMockElasticsearchResponse([mockProduct]);
      mockClient.search.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/search')
        .query({ q: 'minimal' })
        .expect(200);

      expect(response.body.hits[0]).toEqual({
        id: 'minimal-product',
        score: 1.0,
        name: 'Minimal Product'
      });
    });
  });

  describe('Query parameter handling', () => {
    it('should handle missing query parameter', async () => {
      const response = await request(app)
        .get('/search')
        .expect(200);

      expect(response.body).toEqual({ hits: [] });
    });

    it('should handle null query parameter', async () => {
      mockClient.search.mockResolvedValue(createMockElasticsearchResponse([]));
      
      const response = await request(app)
        .get('/search?q=null')
        .expect(200);

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            multi_match: expect.objectContaining({
              query: 'null'
            })
          })
        })
      );
    });

    it('should handle array query parameters', async () => {
      mockClient.search.mockResolvedValue(createMockElasticsearchResponse([]));

      const response = await request(app)
        .get('/search?q[]=first&q[]=second')
        .expect(200);

      // Should convert array to string
      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            multi_match: expect.objectContaining({
              query: 'first,second'
            })
          })
        })
      );
    });
  });
});
