import AuditLog from '@/models/AuditLog.js';

export async function logChange({ productId, action, before, after, changedBy }) {
    await AuditLog.create({ productId, action, before, after, changedBy });
}