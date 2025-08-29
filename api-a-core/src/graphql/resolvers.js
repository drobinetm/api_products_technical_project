import { GraphQLJSON } from 'graphql-type-json';
import { createProduct, updateProduct, approveProduct, getProductWithHistory } from '../services/productService.js';
import AuditLog from '../models/AuditLog.js';

export default {
    JSON: GraphQLJSON,
    Query: {
        product: async (_r, { id }) => getProductWithHistory(id),
    },
    Mutation: {
        createProduct: async (_r, { input }, { user }) => createProduct(input, user),
        updateProduct: async (_r, { id, patch }, { user }) => updateProduct(id, patch, user),
        approveProduct: async (_r, { id }, { user }) => approveProduct(id, user),
    },
    Product: {
        history: async (p) => AuditLog.find({ productId: p._id || p.id }).sort({ createdAt: -1 }),
    },
};