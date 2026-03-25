const mongoose = require('mongoose');

const SessionNoteSchema = new mongoose.Schema({
    clientId: { type: String, required: true }, // client-generated id for deduplication
    title:    { type: String, default: 'Sin título' },
    tag:      { type: String, default: '' },
    content:  { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
}, {
    timestamps: false, // manage manually to preserve client timestamps
});

SessionNoteSchema.index({ clientId: 1 }, { unique: true });

module.exports = mongoose.model('SessionNote', SessionNoteSchema);
