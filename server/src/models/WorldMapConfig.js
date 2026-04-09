const mongoose = require('mongoose');

const hotspotSchema = new mongoose.Schema({
    id:             { type: String, required: true },
    label:          { type: String, required: true, trim: true },
    x:              { type: Number, required: true }, // % of world-map image width
    y:              { type: Number, required: true }, // % of world-map image height
    detailFilename: { type: String, default: '' },
    detailUrl:      { type: String, default: '' },
}, { _id: false });

// Single-document config — always upsert on the singleton key
const worldMapConfigSchema = new mongoose.Schema({
    _singleton: { type: String, default: 'main', unique: true },
    hotspots:   { type: [hotspotSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('WorldMapConfig', worldMapConfigSchema);
