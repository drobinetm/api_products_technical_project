import AuditLog from '../models/AuditLog.js';

export async function logChange({ productId, action, before, after, changedBy }) {
    try {
        const auditData = {
            productId,
            action,
            before,
            after,
            changedBy,
            timestamp: new Date()
        };

        return await AuditLog.create(auditData);
    } catch (error) {
        console.error('Error creating audit log:', error);
        throw new Error('Failed to log change');
    }
}

export async function getAuditLogs(productId) {
    try {
        return await AuditLog.find({ productId })
            .sort({ timestamp: -1 })
            .lean();
    } catch (error) {
        console.error('Error getting audit logs:', error);
        throw new Error('Failed to retrieve audit logs');
    }
}

export async function clearAuditLogs() {
    try {
        return await AuditLog.deleteMany({});
    } catch (error) {
        console.error('Error clearing audit logs:', error);
        throw new Error('Failed to clear audit logs');
    }
}
