const mongoose = require('mongoose');

const combatMapSchema = new mongoose.Schema({
    name:       { type: String, required: true, trim: true },
    filename:   { type: String, default: '' },
    url:        { type: String, default: '' },
    isVideo:    { type: Boolean, default: false },
    // 'upload' = subido manualmente | 'editor' = creado desde el Creador de Mapas
    sourceType: { type: String, enum: ['upload', 'editor'], default: 'upload' },
    // Datos de escena JSON (tiles, walls, fog, etc.) — solo para mapas de editor
    sceneData:  { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

module.exports = mongoose.model('CombatMap', combatMapSchema);
