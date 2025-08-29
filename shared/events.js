export const EVENT_TYPES = {
    PRODUCT_CREATED: 'product.created',
    PRODUCT_UPDATED: 'product.updated',
    PRODUCT_APPROVED: 'product.approved',
};

export function productEventPayload(product) {
    return {
        id: String(product.id || product._id),
        gs1Id: product.gs1Id,
        name: product.name,
        brand: product.brand,
        description: product.description,
        manufacturer: product.manufacturer,
        netWeight: product.netWeight,
        status: product.status, // 'PENDING' | 'PUBLISHED'
        updatedAt: product.updatedAt,
    };
}