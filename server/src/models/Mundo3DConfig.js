const mongoose = require('mongoose');

// Un POI puede estar en una escena 3D (coords esféricas) o 2D (porcentajes sobre imagen)
const poiSchema = new mongoose.Schema({
    id:             { type: String, required: true },
    label:          { type: String, required: true, trim: true, maxlength: 80 },
    // Posición local exacta en el modelo 3D (espacio local del pivot, sin rotación)
    lx:             { type: Number, default: null },
    ly:             { type: Number, default: null },
    lz:             { type: Number, default: null },
    // Coordenadas esféricas (legacy / fallback)
    theta:          { type: Number, default: 0 },
    phi:            { type: Number, default: 1.5708 },
    // Coordenadas porcentuales (escenas image2d)
    x:              { type: Number, default: 50 },
    y:              { type: Number, default: 50 },
    // Detalle al hacer zoom
    detailType:     { type: String, enum: ['none', 'image', 'glb'], default: 'none' },
    detailUrl:      { type: String, default: '' },
    detailFilename: { type: String, default: '' },
    detailSceneId:  { type: String, default: '' },  // sceneId del nivel hijo
}, { _id: false });

// Un documento por escena; el campo sceneId es la clave única.
// La escena raíz usa sceneId: 'm3d_root'.
const mundo3DConfigSchema = new mongoose.Schema({
    sceneId:   { type: String, required: true, unique: true },
    sceneType: { type: String, enum: ['glb3d', 'image2d'], default: 'glb3d' },
    hotspots:  { type: [poiSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Mundo3DConfig', mundo3DConfigSchema);
