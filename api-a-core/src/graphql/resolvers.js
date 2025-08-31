import { GraphQLJSON } from 'graphql-type-json';
import productService from '@/services/product.service.js';

/**
 * GraphQL resolvers for the Product type and related operations
 */
export default {
    JSON: GraphQLJSON,
    
    Query: {
        /**
         * Get a single product by ID with its history
         */
        product: async (_, { id }) => {
            return productService.getProductWithHistory(id);
        },
        
        /**
         * Get paginated list of products
         */
        products: async (_, { page, limit }) => {
            return productService.getAllProducts(page, limit);
        },
    },
    
    Mutation: {
        /**
         * Create a new product
         */
        createProduct: async (_, { input }, { user }) => {
            if (!user) {
                throw new Error('Authentication required');
            }
            return productService.createProduct(input, user);
        },
        
        /**
         * Update an existing product
         */
        updateProduct: async (_, { id, patch }, { user }) => {
            if (!user) {
                throw new Error('Authentication required');
            }
            return productService.updateProduct(id, patch, user);
        },
        
        /**
         * Approve a pending product
         */
        approveProduct: async (_, { id }, { user }) => {
            if (!user) {
                throw new Error('Authentication required');
            }
            return productService.approveProduct(id, user);
        },
        
        /**
         * Clear all products (admin only)
         */
        clearProducts: async () => {
            // Note: Authentication check is handled in the service layer
            return productService.clearProducts();
        },
    },
    
    Product: {
        /**
         * Get the history/audit log for a product
         * This is now handled by the getProductWithHistory service method
         */
        history: (product) => {
            // The history is already included in the product object
            // when using getProductWithHistory
            return product.history || [];
        },
    },
};