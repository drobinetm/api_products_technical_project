import Product from '../models/Product.js';
import { logChange } from './auditService.js';
import { publishEvent } from '../bus/publisher.js';
import { EVENT_TYPES, productEventPayload } from '../../../shared/events.js';

const bus = {
    url: process.env.RABBITMQ_URL,
    exchange: process.env.RABBITMQ_EXCHANGE,
};

export async function createProduct(input, user) {
    const created = await Product.create({
        ...input,
        status: user.role === 'EDITOR' ? 'PUBLISHED' : 'PENDING',
        createdByRole: user.role,
    });
    await logChange({
        productId: created._id,
        action: 'CREATE',
        before: null,
        after: created.toObject(),
        changedBy: user.role,
    });
    await publishEvent({
        url: bus.url,
        exchange: bus.exchange,
        routingKey: EVENT_TYPES.PRODUCT_CREATED,
        payload: productEventPayload(created),
    });
    return created;
}

export async function updateProduct(id, patch, user) {
    const before = await Product.findById(id).lean();
    if (!before) throw new Error('Product not found');
    const updated = await Product.findByIdAndUpdate(id, patch, { new: true });
    await logChange({
        productId: id,
        action: 'UPDATE',
        before,
        after: updated.toObject(),
        changedBy: user.role,
    });
    await publishEvent({
        url: bus.url,
        exchange: bus.exchange,
        routingKey: EVENT_TYPES.PRODUCT_UPDATED,
        payload: productEventPayload(updated),
    });
    return updated;
}

export async function approveProduct(id, user) {
    if (user.role !== 'EDITOR') throw new Error('Forbidden');
    const before = await Product.findById(id).lean();
    if (!before) throw new Error('Product not found');
    const updated = await Product.findByIdAndUpdate(id, { status: 'PUBLISHED' }, { new: true });
    await logChange({
        productId: id,
        action: 'APPROVE',
        before,
        after: updated.toObject(),
        changedBy: 'EDITOR',
    });
    await publishEvent({
        url: bus.url,
        exchange: bus.exchange,
        routingKey: EVENT_TYPES.PRODUCT_APPROVED,
        payload: productEventPayload(updated),
    });
    return updated;
}

export async function clearProducts() {
    await Product.deleteMany({});
    // Also clear audit logs
    const AuditLog = (await import('../models/AuditLog.js')).default;
    await AuditLog.deleteMany({});
    
    // Publish clear event to update search index
    await publishEvent({
        url: bus.url,
        exchange: bus.exchange,
        routingKey: EVENT_TYPES.PRODUCTS_CLEARED,
        payload: { action: 'clear_all' },
    });
    
    return { success: true };
}

export async function getAllProducts(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const total = await Product.countDocuments();
    const items = await Product.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    
    const pages = Math.ceil(total / limit);
    
    // Map MongoDB _id to GraphQL id field
    const mappedItems = items.map(item => ({
        ...item,
        id: item._id.toString(),
    }));
    
    return {
        total,
        page,
        pages,
        items: mappedItems,
    };
}

export async function getProductWithHistory(id) {
    const ProductModel = (await import('../models/Product.js')).default;
    const AuditLog = (await import('../models/AuditLog.js')).default;
    const product = await ProductModel.findById(id).lean();
    if (!product) throw new Error('Not found');
    const history = await AuditLog.find({ productId: id }).sort({ createdAt: -1 }).lean();
    return { ...product, history };
}
