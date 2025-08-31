import Product from '../models/Product.js';
import { logChange } from './audit.service.js';
import { publishEvent } from '../bus/publisher.event.js';
import { EVENT_TYPES, productEventPayload } from '../shared/events.js';
import createError from 'http-errors';

// Constants
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const STATUS = {
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED'
};

// Error messages
const ERRORS = {
  PRODUCT_NOT_FOUND: 'Product not found',
  FORBIDDEN: 'You do not have permission to perform this action',
  INVALID_INPUT: 'Invalid input provided',
};

/**
 * Product service for handling business logic related to products
 */
class ProductService {
  /**
   * @param {Object} dependencies - Service dependencies
   * @param {Object} dependencies.bus - Message bus configuration
   */
  constructor(dependencies = {}) {
    this.bus = {
      url: process.env.RABBITMQ_URL,
      exchange: process.env.RABBITMQ_EXCHANGE,
      ...dependencies.bus
    };
  }

  /**
   * Create a new product
   * @param {Object} input - Product data
   * @param {Object} user - User making the request
   * @returns {Promise<Object>} Created product
   */
  async createProduct(input, user) {
    if (!input || !user) {
      throw createError.BadRequest(ERRORS.INVALID_INPUT);
    }

    try {
      const productData = {
        ...input,
        status: user.role === 'EDITOR' ? STATUS.PUBLISHED : STATUS.PENDING,
        createdByRole: user.role,
      };

      const created = await Product.create(productData);
      
      await this._logProductChange({
        productId: created._id,
        action: 'CREATE',
        before: null,
        after: created.toObject(),
        changedBy: user.role,
      });

      await this._publishEvent(EVENT_TYPES.PRODUCT_CREATED, created);
      
      return created;
    } catch (error) {
      this._handleError(error);
    }
  }

  /**
   * Update an existing product
   * @param {string} id - Product ID
   * @param {Object} patch - Fields to update
   * @param {Object} user - User making the request
   * @returns {Promise<Object>} Updated product
   */
  async updateProduct(id, patch, user) {
    if (!id || !patch || !user) {
      throw createError.BadRequest(ERRORS.INVALID_INPUT);
    }

    try {
      const before = await Product.findById(id).lean();
      if (!before) {
        throw createError.NotFound(ERRORS.PRODUCT_NOT_FOUND);
      }

      const updated = await Product.findByIdAndUpdate(id, patch, { new: true });
      
      await this._logProductChange({
        productId: id,
        action: 'UPDATE',
        before,
        after: updated.toObject(),
        changedBy: user.role,
      });

      await this._publishEvent(EVENT_TYPES.PRODUCT_UPDATED, updated);
      
      return updated;
    } catch (error) {
      this._handleError(error);
    }
  }

  /**
   * Approve a pending product
   * @param {string} id - Product ID
   * @param {Object} user - User making the request
   * @returns {Promise<Object>} Approved product
   */
  async approveProduct(id, user) {
    if (!id || !user) {
      throw createError.BadRequest(ERRORS.INVALID_INPUT);
    }

    if (user.role !== 'EDITOR') {
      throw createError.Forbidden(ERRORS.FORBIDDEN);
    }

    try {
      const before = await Product.findById(id).lean();
      if (!before) {
        throw createError.NotFound(ERRORS.PRODUCT_NOT_FOUND);
      }

      const updated = await Product.findByIdAndUpdate(
        id, 
        { status: STATUS.PUBLISHED }, 
        { new: true }
      );
      
      await this._logProductChange({
        productId: id,
        action: 'APPROVE',
        before,
        after: updated.toObject(),
        changedBy: 'EDITOR',
      });

      await this._publishEvent(EVENT_TYPES.PRODUCT_APPROVED, updated);
      
      return updated;
    } catch (error) {
      this._handleError(error);
    }
  }

  /**
   * Get paginated list of products
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Object>} Paginated products
   */
  async getAllProducts(page = DEFAULT_PAGE, limit = DEFAULT_LIMIT) {
    try {
      const skip = (page - 1) * limit;
      const [total, items] = await Promise.all([
        Product.countDocuments(),
        Product.find()
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
      ]);
      
      const pages = Math.ceil(total / limit);
      
      return {
        total,
        page,
        pages,
        items: items.map(item => ({
          ...item,
          id: item._id.toString(),
        })),
      };
    } catch (error) {
      this._handleError(error);
    }
  }

  /**
   * Get a product with its audit history
   * @param {string} id - Product ID
   * @returns {Promise<Object>} Product with history
   */
  async getProductWithHistory(id) {
    if (!id) {
      throw createError.BadRequest(ERRORS.INVALID_INPUT);
    }

    try {
      const [product, history] = await Promise.all([
        Product.findById(id).lean(),
        this._getAuditLogs(id)
      ]);

      if (!product) {
        throw createError.NotFound(ERRORS.PRODUCT_NOT_FOUND);
      }

      return { ...product, history };
    } catch (error) {
      this._handleError(error);
    }
  }

  /**
   * Clear all products and their audit logs
   * @returns {Promise<Object>} Success status
   */
  async clearProducts() {
    try {
      const [_, __] = await Promise.all([
        Product.deleteMany({}),
        this._clearAuditLogs()
      ]);

      await this._publishEvent(EVENT_TYPES.PRODUCTS_CLEARED, { action: 'clear_all' });
      
      return { success: true };
    } catch (error) {
      this._handleError(error);
    }
  }

  // Private methods

  /**
   * Publish event to message bus
   * @private
   */
  async _publishEvent(eventType, data) {
    try {
      await publishEvent({
        url: this.bus.url,
        exchange: this.bus.exchange,
        routingKey: eventType,
        payload: productEventPayload(data),
      });
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Failed to publish event:', error);
    }
  }

  /**
   * Log product changes to audit log
   * @private
   */
  async _logProductChange({ productId, action, before, after, changedBy }) {
    try {
      await logChange({
        productId,
        action,
        before,
        after,
        changedBy,
      });
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Failed to log change:', error);
    }
  }

  /**
   * Get audit logs for a product
   * @private
   */
  async _getAuditLogs(productId) {
    const AuditLog = (await import('../models/AuditLog.js')).default;
    return AuditLog.find({ productId }).sort({ createdAt: -1 }).lean();
  }

  /**
   * Clear all audit logs
   * @private
   */
  async _clearAuditLogs() {
    const AuditLog = (await import('../models/AuditLog.js')).default;
    return AuditLog.deleteMany({});
  }

  /**
   * Handle errors consistently
   * @private
   */
  _handleError(error) {
    if (error.status) throw error;
    console.error('Product service error:', error);
    throw createError.InternalServerError('An unexpected error occurred');
  }
}

export default new ProductService();
