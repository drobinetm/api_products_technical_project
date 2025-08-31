import AuditLog from '@/models/AuditLog.js';

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
        const result = await AuditLog.create(auditData);
        return result;
    } catch (error) {
        console.error('Error creating audit log:', error);
        throw new Error('Failed to log change');
    }
}

export async function getAuditLogs(productId) {
    try {
        const logs = await AuditLog.find({ productId })
            .sort({ timestamp: -1 })
            .lean();
        return logs;
    } catch (error) {
        console.error('Error getting audit logs:', error);
        throw new Error('Failed to retrieve audit logs');
    }
}

export async function clearAuditLogs() {
    try {
        const result = await AuditLog.deleteMany({});
        return result;
    } catch (error) {
        console.error('Error clearing audit logs:', error);
        throw new Error('Failed to clear audit logs');
    }
}
