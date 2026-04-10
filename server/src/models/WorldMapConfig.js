const mongoose = require('mongoose');

const hotspotSchema = new mongoose.Schema({
    id:             { type: String, required: true },
    label:          { type: String, required: true, trim: true },
    x:              { type: Number, required: true },
    y:              { type: Number, required: true },
    detailFilename: { type: String, default: '' },
    detailUrl:      { type: String, default: '' },
}, { _id: false });

// Un documento por mapa; el campo mapId es la clave única.
// El mapa raíz usa mapId: 'world'.
const worldMapConfigSchema = new mongoose.Schema({
    mapId:      { type: String, required: true, unique: true },
    // Mantenemos _singleton para retro-compatibilidad con datos anteriores
    _singleton: { type: String },
    hotspots:   { type: [hotspotSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('WorldMapConfig', worldMapConfigSchema);
