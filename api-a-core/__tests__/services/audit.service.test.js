import { jest } from '@jest/globals';

// Mock the AuditLog model
jest.mock('@/models/AuditLog.js', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    find: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

// Import the mocks
import AuditLog from '@/models/AuditLog.js';
import { logChange, getAuditLogs, clearAuditLogs } from '@/services/audit.service.js';

const mockAuditLog = jest.mocked(AuditLog);

describe('Audit Service', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('logChange', () => {
    it('should create an audit log entry', async () => {
      // Arrange
      const auditData = {
        productId: '123',
        action: 'CREATE',
        before: null,
        after: { name: 'Test Product' },
        changedBy: 'testuser',
      };

      const createdLog = {
        _id: 'audit123',
        ...auditData,
        timestamp: expect.any(Date),
        save: jest.fn().mockResolvedValue(true),
      };

      // Use jest.spyOn and mockImplementation
      jest.spyOn(AuditLog, 'create').mockImplementation(async data => {
        return Promise.resolve(createdLog);
      });

      // Act
      const result = await logChange(auditData);

      // Assert
      expect(AuditLog.create).toHaveBeenCalledWith({
        productId: auditData.productId,
        action: auditData.action,
        before: auditData.before,
        after: auditData.after,
        changedBy: auditData.changedBy,
        timestamp: expect.any(Date),
      });
      expect(result).toEqual(createdLog);
    });

    it('should handle errors when creating audit log', async () => {
      // Arrange
      const error = new Error('Database error');
      jest.spyOn(AuditLog, 'create').mockImplementation(async () => {
        throw error;
      });

      // Act & Assert
      await expect(
        logChange({
          productId: '123',
          action: 'CREATE',
          before: null,
          after: {},
          changedBy: 'testuser',
        })
      ).rejects.toThrow('Failed to log change');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error creating audit log:', error);
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs for a product', async () => {
      // Arrange
      const productId = '123';
      const mockLogs = [
        { _id: '1', action: 'CREATE' },
        { _id: '2', action: 'UPDATE' },
      ];

      jest.spyOn(AuditLog, 'find').mockImplementation(() => ({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockLogs),
        }),
      }));

      // Act
      const result = await getAuditLogs(productId);

      // Assert
      expect(AuditLog.find).toHaveBeenCalledWith({ productId });
      expect(result).toEqual(mockLogs);
    });

    it('should handle errors when retrieving audit logs', async () => {
      // Arrange
      const error = new Error('Database error');
      jest.spyOn(AuditLog, 'find').mockImplementation(() => ({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(error),
        }),
      }));

      // Act & Assert
      await expect(getAuditLogs('123')).rejects.toThrow('Failed to retrieve audit logs');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting audit logs:', error);
    });
  });

  describe('clearAuditLogs', () => {
    it('should clear all audit logs', async () => {
      // Arrange
      const deleteResult = { deletedCount: 5 };
      jest.spyOn(AuditLog, 'deleteMany').mockImplementation(async () => {
        return Promise.resolve(deleteResult);
      });

      // Act
      const result = await clearAuditLogs();

      // Assert
      expect(AuditLog.deleteMany).toHaveBeenCalledWith({});
      expect(result).toEqual(deleteResult);
    });

    it('should handle errors when clearing audit logs', async () => {
      // Arrange
      const error = new Error('Database error');
      jest.spyOn(AuditLog, 'deleteMany').mockImplementation(async () => {
        throw error;
      });

      // Act & Assert
      await expect(clearAuditLogs()).rejects.toThrow('Failed to clear audit logs');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error clearing audit logs:', error);
    });
  });
});
