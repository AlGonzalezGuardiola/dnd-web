const mongoose = require('mongoose');

const narrativeImageSchema = new mongoose.Schema({
    name:        { type: String, required: true, trim: true },
    filename:    { type: String, required: true },
    url:         { type: String, required: true },
    description: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('NarrativeImage', narrativeImageSchema);
