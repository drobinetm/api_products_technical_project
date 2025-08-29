import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },
    action: { type: String, enum: ['CREATE', 'UPDATE', 'APPROVE'] },
    changedBy: { type: String }, // userId o email
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

export default mongoose.model('AuditLog', AuditLogSchema);