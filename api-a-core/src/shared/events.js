export const EVENT_TYPES = {
    PRODUCT_CREATED: 'PRODUCT_CREATED',
    PRODUCT_UPDATED: 'PRODUCT_UPDATED',
    PRODUCT_APPROVED: 'PRODUCT_APPROVED',
    PRODUCTS_CLEARED: 'PRODUCTS_CLEARED',
};

export function productEventPayload(data) {
    return {
        ...data,
        timestamp: new Date().toISOString()
    };
}
