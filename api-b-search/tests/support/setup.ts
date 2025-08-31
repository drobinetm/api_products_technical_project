import { vi } from 'vitest';

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.ELASTIC_URL = 'http://localhost:9200';
process.env.RABBITMQ_URL = 'amqp://localhost:5672';
process.env.RABBITMQ_EXCHANGE = 'test-exchange';
process.env.RABBITMQ_QUEUE = 'test-queue';

// Global test setup
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});

// Global error handler for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
