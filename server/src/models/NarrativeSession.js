const mongoose = require('mongoose');

const NarrativeSessionSchema = new mongoose.Schema({
    clientId:    { type: String, required: true },          // client-generated ID for upsert
    number:      { type: Number, required: true, min: 1 },  // session number (1-based)
    title:       { type: String, default: 'Sin título' },
    sessionDate: { type: String, default: '' },             // YYYY-MM-DD string
    summary:     { type: String, default: '' },             // short tagline shown in italic
    content:     { type: String, default: '' },             // full narrative prose
    tags:        { type: [String], default: [] },
    createdAt:   { type: Date, default: Date.now },
    updatedAt:   { type: Date, default: Date.now },
}, { timestamps: false });

NarrativeSessionSchema.index({ clientId: 1 }, { unique: true });

module.exports = mongoose.model('NarrativeSession', NarrativeSessionSchema);
