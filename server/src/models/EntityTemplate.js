const mongoose = require('mongoose');

// ── Action sub-schema (reusable) ─────────────────────────────────────────────
const TemplateActionSchema = new mongoose.Schema({
    name:        { type: String, required: true },
    type:        { type: String, enum: ['ACTION', 'BONUS_ACTION', 'REACTION', 'EXTRA_ATTACK'], default: 'ACTION' },
    description: { type: String, default: '' },
}, { _id: false });

// ── EntityTemplate schema ─────────────────────────────────────────────────────
// Reusable NPC/group template.  No initiative — that is rolled fresh each combat.
const EntityTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, enum: ['ALLY', 'ENEMY'], required: true },

    // Base stats (no initiative — rolled per-combat)
    stats: {
        hp: { type: Number, default: 10 },
        ac: { type: Number, default: 10 },
    },

    // Actions library
    actions: { type: [TemplateActionSchema], default: [] },

    // Group config
    isGroup:   { type: Boolean, default: false },
    groupSize: { type: Number,  default: 1 },

    // Summon config
    isSummon: { type: Boolean, default: false },
    summoner: { type: String, enum: ['ASTHOR', 'ZERO', ''], default: '' },
}, {
    timestamps: true,
});

// Compound index: (name + type) uniqueness so we can upsert by name
EntityTemplateSchema.index({ name: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('EntityTemplate', EntityTemplateSchema);
