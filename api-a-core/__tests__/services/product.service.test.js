import { jest } from '@jest/globals';

// ───────────────────────────────────────────────────────────────────────────────
// Mocks de dependencias externas
// ───────────────────────────────────────────────────────────────────────────────

jest.mock('@/models/Product.js', () => {
  const fn = jest.fn();
  return {
    __esModule: true,
    default: {
      create: fn(),
      findById: fn(),
      findByIdAndUpdate: fn(),
      deleteMany: fn(),
      countDocuments: fn(),
      find: fn(),
    },
  };
});

jest.mock('@/services/audit.service.js', () => ({
  __esModule: true,
  logChange: jest.fn(),
}));

jest.mock('@/bus/publisher.event.js', () => ({
  __esModule: true,
  publishEvent: jest.fn(),
}));

jest.mock('@/shared/events.js', () => ({
  __esModule: true,
  EVENT_TYPES: {
    PRODUCT_CREATED: 'PRODUCT_CREATED',
    PRODUCT_UPDATED: 'PRODUCT_UPDATED',
    PRODUCT_APPROVED: 'PRODUCT_APPROVED',
    PRODUCTS_CLEARED: 'PRODUCTS_CLEARED',
  },
  productEventPayload: jest.fn((data) => ({ wrapped: data })),
}));

// Importa los mocks para poder configurarlos en cada test
import Product from '@/models/Product.js';
import { logChange } from '@/services/audit.service.js';
import { publishEvent } from '@/bus/publisher.event.js';
import { EVENT_TYPES, productEventPayload } from '@/shared/events.js';

// Utilidad para cargar el SUT (crea una nueva instancia con ENV actual)
const loadService = async () => {
  jest.resetModules();
  const mod = await import('@/services/product.service.js');
  return mod.default;
};

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

  // ... (rest of your test cases)
});
