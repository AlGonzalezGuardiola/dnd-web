const mongoose = require('mongoose');

const CombatTemplateSchema = new mongoose.Schema({
    name:        { type: String, required: true },
    selectedIds: [{ type: String }],
    npcs:        { type: mongoose.Schema.Types.Mixed, default: [] },
    initiatives: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('CombatTemplate', CombatTemplateSchema);
