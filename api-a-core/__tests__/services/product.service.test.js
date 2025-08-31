import { jest } from '@jest/globals';

// ───────────────────────────────────────────────────────────────────────────────
// Mocks de dependencias externas
// ───────────────────────────────────────────────────────────────────────────────

jest.mock('@/models/Product.js', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    deleteMany: jest.fn(),
    countDocuments: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock('@/services/audit.service.js', () => ({
  __esModule: true,
  logChange: jest.fn(),
}));

jest.mock('@/bus/publisher.event.js', () => ({
  __esModule: true,
  publishEvent: jest.fn(),
}));

jest.mock('shared/events.js', () => ({
  __esModule: true,
  EVENT_TYPES: {
    PRODUCT_CREATED: 'product.created',
    PRODUCT_UPDATED: 'product.updated',
    PRODUCT_APPROVED: 'product.approved',
    PRODUCTS_CLEARED: 'product.cleared',
  },
  productEventPayload: jest.fn(data => ({ wrapped: data })),
}));

// Importa los mocks para poder configurarlos en cada test
import Product from '@/models/Product.js';
import { logChange } from '@/services/audit.service.js';
import { publishEvent } from '@/bus/publisher.event.js';
import { EVENT_TYPES, productEventPayload } from 'shared/events.js';
import ProductService from '@/services/product.service.js';

describe('ProductService', () => {
  let consoleErrorSpy;

  beforeAll(() => {
    // Valores del bus leídos en el constructor del servicio
    process.env.RABBITMQ_URL = 'amqp://localhost:5672';
    process.env.RABBITMQ_EXCHANGE = 'products.exchange';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('createProduct', () => {
    it('should create a product successfully', async () => {
      // Arrange
      const input = { name: 'Test Product', price: 10 };
      const user = { role: 'EDITOR' };
      const mockProduct = {
        _id: '123',
        ...input,
        status: 'PUBLISHED',
        createdByRole: 'EDITOR',
        toObject: () => ({ _id: '123', ...input, status: 'PUBLISHED' }),
      };

      jest.spyOn(Product, 'create').mockImplementation(async data => {
        return Promise.resolve(mockProduct);
      });

      // Act
      const result = await ProductService.createProduct(input, user);

      // Assert
      expect(Product.create).toHaveBeenCalledWith({
        ...input,
        status: 'PUBLISHED',
        createdByRole: 'EDITOR',
      });
      expect(result).toEqual(mockProduct);
    });
  });

  describe('getAllProducts', () => {
    it('should return paginated products', async () => {
      // Arrange
      const mockProducts = [
        { _id: '1', name: 'Product 1' },
        { _id: '2', name: 'Product 2' },
      ];

      jest.spyOn(Product, 'countDocuments').mockImplementation(async () => {
        return Promise.resolve(2);
      });
      jest.spyOn(Product, 'find').mockImplementation(() => ({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockProducts),
      }));

      // Act
      const result = await ProductService.getAllProducts(1, 10);

      // Assert
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.items).toHaveLength(2);
    });
  });
});
