const mongoose = require('mongoose');

const CharModelSchema = new mongoose.Schema({
    charId:   { type: String, required: true, unique: true },
    filename: { type: String, required: true },
    url:      { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('CharModel', CharModelSchema);
