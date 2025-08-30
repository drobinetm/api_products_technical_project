import { GraphQLJSON } from 'graphql-type-json';
import { createProduct, updateProduct, approveProduct, getProductWithHistory, getAllProducts, clearProducts } from '../services/productService.js';
import AuditLog from '../models/AuditLog.js';

export default {
    JSON: GraphQLJSON,
    Query: {
        product: async (_r, { id }) => getProductWithHistory(id),
        products: async (_r, { page, limit }) => getAllProducts(page, limit),
    },
    Mutation: {
        createProduct: async (_r, { input }, { user }) => createProduct(input, user),
        updateProduct: async (_r, { id, patch }, { user }) => updateProduct(id, patch, user),
        approveProduct: async (_r, { id }, { user }) => approveProduct(id, user),
        clearProducts: async () => clearProducts(),
    },
    Product: {
        history: async (p) => AuditLog.find({ productId: p._id || p.id }).sort({ createdAt: -1 }),
    },
};