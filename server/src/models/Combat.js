const mongoose = require('mongoose');

// ── Sub-schemas ─────────────────────────────────────────────────────────────

const HpSchema = new mongoose.Schema({
    current: { type: Number, default: 0 },
    max:     { type: Number, default: 0 },
}, { _id: false });

const ParticipantSchema = new mongoose.Schema({
    id:          { type: String, required: true },
    name:        { type: String, required: true },
    tipo:        { type: String, enum: ['jugador', 'aliado', 'enemigo'], required: true },
    initiative:  { type: Number, default: 0 },
    hp:          { type: HpSchema, default: () => ({}) },
    ac:          { type: String, default: '10' },
    speed:       { type: String, default: '' },
    conditions:  { type: [String], default: [] },
    note:        { type: String, default: '' },
    // optional combat flags
    demonicForm:     { type: Boolean, default: false },
    sirvienteActive: { type: Boolean, default: false },
    ownerCharId:     { type: String, default: null },
}, { _id: false });

const ActionSchema = new mongoose.Schema({
    nombre:       { type: String },
    dice:         { type: String },
    rollText:     { type: String },
    narratorText: { type: String },
}, { _id: false });

const SnapshotParticipantSchema = new mongoose.Schema({
    id:         { type: String },
    hp:         { type: HpSchema, default: () => ({}) },
    conditions: { type: [String], default: [] },
    demonicForm:{ type: Boolean },
    ac:         { type: String },
    speed:      { type: String },
}, { _id: false });

const LogEntrySchema = new mongoose.Schema({
    id:               { type: Number, required: true },
    round:            { type: Number, required: true },
    participantId:    { type: String },
    participantName:  { type: String },
    actions:          { type: [ActionSchema], default: [] },
    slots: {
        accion:      { type: Boolean, default: false },
        extraAtaque: { type: Boolean, default: false },
        adicional:   { type: Boolean, default: false },
        reaccion:    { type: Boolean, default: false },
    },
    note:             { type: String, default: '' },
    isCurrent:        { type: Boolean, default: false },
    isSegundaAccion:  { type: Boolean, default: false },
    isExtraAttack:    { type: Boolean, default: false },
    snapshot: {
        currentIndex:      { type: Number },
        round:             { type: Number },
        segundaAccionTurn: { type: Boolean },
        extraAttackTurn:   { type: Boolean },
        participants:      { type: [SnapshotParticipantSchema], default: [] },
    },
}, { _id: false });

// ── Main Combat schema ───────────────────────────────────────────────────────

const CombatSchema = new mongoose.Schema({
    // Código corto para unirse (6 chars, único, generado al crear)
    joinCode: { type: String, required: true, unique: true, uppercase: true },

    // Participants split by role for quick filtering
    players:  { type: [ParticipantSchema], default: [] },  // tipo jugador
    npcs:     { type: [ParticipantSchema], default: [] },  // tipo aliado
    enemies:  { type: [ParticipantSchema], default: [] },  // tipo enemigo

    // Full sorted participant list (mirrors combatState.participants)
    participants: { type: [ParticipantSchema], default: [] },

    // Turn state
    currentIndex:      { type: Number, default: 0 },
    round:             { type: Number, default: 1 },
    isActive:          { type: Boolean, default: true },
    segundaAccionTurn: { type: Boolean, default: false },
    extraAttackTurn:   { type: Boolean, default: false },
    nextLogId:         { type: Number, default: 0 },

    // Combat log
    log: { type: [LogEntrySchema], default: [] },

    // Metadata
    name:      { type: String, default: '' },   // optional session name
    createdBy: { type: String, default: '' },   // optional GM identifier
}, {
    timestamps: true,   // adds createdAt + updatedAt
});

module.exports = mongoose.model('Combat', CombatSchema);
