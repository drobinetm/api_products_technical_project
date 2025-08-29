import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
    gs1Id: { type: String, unique: true, required: true },
    name: String,
    description: String,
    brand: String,
    manufacturer: String,
    netWeight: String,
    status: { type: String, enum: ['PENDING', 'PUBLISHED'], default: 'PENDING' },
    createdByRole: { type: String, enum: ['PROVIDER', 'EDITOR'], required: true },
}, { timestamps: true });

export default mongoose.model('Product', ProductSchema);