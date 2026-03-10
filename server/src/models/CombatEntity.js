const mongoose = require('mongoose');

const ActionSchema = new mongoose.Schema({
    name:        { type: String, required: true },
    type:        { type: String, enum: ['ACTION', 'BONUS_ACTION', 'REACTION', 'EXTRA_ATTACK'], default: 'ACTION' },
    description: { type: String, default: '' },
}, { _id: false });

const CombatEntitySchema = new mongoose.Schema({
    // ── Identity ──────────────────────────────────────────────────────────────
    name:      { type: String, required: true },
    type:      { type: String, enum: ['ALLY', 'ENEMY'], required: true },
    stats: {
        hp:         { type: Number, default: 10 },
        ac:         { type: Number, default: 10 },
        initiative: { type: Number, default: 0 },
    },
    actions: { type: [ActionSchema], default: [] },

    // ── Group fields (isGroup === true) ───────────────────────────────────────
    isGroup:          { type: Boolean, default: false },
    groupSize:        { type: Number,  default: 1 },   // initial member count
    membersRemaining: { type: Number,  default: 1 },   // current survivors
    hpPerMember:      { type: Number,  default: 10 },  // max HP per member
    totalHp:          { type: Number,  default: 10 },  // current aggregate HP
    currentMemberHp:  { type: Number,  default: 10 },  // HP of the partially-damaged front member

    // ── Summon / invocation fields ────────────────────────────────────────────
    isSummon:            { type: Boolean, default: false },
    summoner:            { type: String,  enum: ['ASTHOR', 'ZERO', ''], default: '' },
    summonedBeforeCombat:{ type: Boolean, default: false },

    // ── Session link ──────────────────────────────────────────────────────────
    combatId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Combat', default: null },
    sessionId: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('CombatEntity', CombatEntitySchema);
