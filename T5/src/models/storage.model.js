// src/models/storage.model.js
import mongoose from 'mongoose';

const storageSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },
    originalName: String,
    url: {
        type: String,
        required: true
    },
    mimetype: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    versionKey: false
});

const Storage = mongoose.model('Storage', storageSchema);
export default Storage;