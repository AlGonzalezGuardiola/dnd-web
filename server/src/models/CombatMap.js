const mongoose = require('mongoose');

const combatMapSchema = new mongoose.Schema({
    name:     { type: String, required: true, trim: true },
    filename: { type: String, required: true },
    url:      { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('CombatMap', combatMapSchema);
