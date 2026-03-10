const mongoose = require('mongoose');

const ActionSchema = new mongoose.Schema({
    name:        { type: String, required: true },
    type:        { type: String, enum: ['ACTION', 'BONUS_ACTION', 'REACTION', 'EXTRA_ATTACK'], default: 'ACTION' },
    description: { type: String, default: '' },
}, { _id: false });

const CombatEntitySchema = new mongoose.Schema({
    name:      { type: String, required: true },
    type:      { type: String, enum: ['ALLY', 'ENEMY'], required: true },
    stats: {
        hp:         { type: Number, default: 10 },
        ac:         { type: Number, default: 10 },
        initiative: { type: Number, default: 0 },
    },
    actions:   { type: [ActionSchema], default: [] },
    combatId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Combat', default: null },
    sessionId: { type: String, default: '' }, // joinCode of the combat session
}, { timestamps: true });

module.exports = mongoose.model('CombatEntity', CombatEntitySchema);
