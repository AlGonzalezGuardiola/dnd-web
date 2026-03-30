// ============================================
// Combat Maps — gestión de mapas de combate
// Almacena metadatos en MongoDB + archivo en disco (web/assets/mapas/)
// Upload via base64 JSON (imágenes hasta 15 MB, vídeos hasta 100 MB)
// Editor maps via POST/PATCH con sceneData JSON
// ============================================

const express   = require('express');
const router    = express.Router();
const fs        = require('fs');
const path      = require('path');
const CombatMap = require('../models/CombatMap');

const MAPS_DIR = path.join(__dirname, '../../../web/assets/mapas');

const ALLOWED_MIMES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm',
]);
const MIME_TO_EXT = {
    'image/jpeg': '.jpg',
    'image/png':  '.png',
    'image/webp': '.webp',
    'image/gif':  '.gif',
    'video/mp4':  '.mp4',
    'video/webm': '.webm',
};
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm']);

function ensureMapsDir() {
    if (!fs.existsSync(MAPS_DIR)) fs.mkdirSync(MAPS_DIR, { recursive: true });
}

function sanitizeFilename(original, mime) {
    const ext  = MIME_TO_EXT[mime] || path.extname(original).toLowerCase() || '.bin';
    const base = path.basename(original, path.extname(original))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'mapa';
    return `${Date.now()}-${base}${ext}`;
}

// Guarda base64 en disco y devuelve { filename, url }
function saveBase64File(fileData, originalName) {
    const match = fileData.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Formato de archivo inválido');

    const [, mime, b64] = match;
    if (!ALLOWED_MIMES.has(mime)) {
        throw new Error('Tipo no permitido (usa JPG, PNG, WebP, GIF, MP4 o WebM)');
    }

    const buffer  = Buffer.from(b64, 'base64');
    const isVideo = VIDEO_MIMES.has(mime);
    const maxSize = isVideo ? 100 * 1024 * 1024 : 15 * 1024 * 1024;

    if (buffer.length > maxSize) {
        throw new Error(isVideo ? 'El vídeo supera los 100 MB' : 'La imagen supera los 15 MB');
    }

    ensureMapsDir();
    const filename = sanitizeFilename(originalName || 'mapa', mime);
    const filepath = path.join(MAPS_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    return { filename, url: `assets/mapas/${filename}`, isVideo };
}

// ─── GET /api/combat-maps — lista todos los mapas ─────────────────────────────

router.get('/', async (_req, res) => {
    try {
        const maps = await CombatMap.find().sort({ createdAt: -1 });
        res.json(maps);
    } catch (err) {
        console.error('[GET /api/combat-maps]', err);
        res.status(500).json({ error: 'Error obteniendo mapas', detail: err.message });
    }
});

// ─── GET /api/combat-maps/:id — obtiene un mapa concreto (para el editor) ─────

router.get('/:id', async (req, res) => {
    try {
        const doc = await CombatMap.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Mapa no encontrado' });
        res.json(doc);
    } catch (err) {
        console.error('[GET /api/combat-maps/:id]', err);
        res.status(500).json({ error: 'Error obteniendo mapa', detail: err.message });
    }
});

// ─── POST /api/combat-maps — sube mapa (upload o editor) ─────────────────────
// Body upload:  { name, filename, fileData: "data:<mime>;base64,<data>" }
// Body editor:  { name, sourceType: "editor", sceneData: {...}, fileData? }

router.post('/', express.json({ limit: '140mb' }), async (req, res) => {
    try {
        const { name, filename: originalName, fileData, sceneData, sourceType } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }

        const isEditorMap = sourceType === 'editor';

        // Mapas del editor pueden no tener imagen inicial
        if (!isEditorMap && (!fileData || !fileData.startsWith('data:'))) {
            return res.status(400).json({ error: 'Datos de archivo inválidos' });
        }

        let fileInfo = { filename: '', url: '', isVideo: false };

        if (fileData && fileData.startsWith('data:')) {
            fileInfo = saveBase64File(fileData, originalName || 'mapa');
        }

        const doc = await CombatMap.create({
            name:       name.trim(),
            filename:   fileInfo.filename,
            url:        fileInfo.url,
            isVideo:    fileInfo.isVideo,
            sourceType: isEditorMap ? 'editor' : 'upload',
            sceneData:  isEditorMap ? (sceneData || null) : null,
        });

        res.status(201).json(doc);
    } catch (err) {
        console.error('[POST /api/combat-maps]', err);
        res.status(500).json({ error: 'Error subiendo archivo', detail: err.message });
    }
});

// ─── PATCH /api/combat-maps/:id — actualiza mapa del editor ──────────────────
// Body: { name?, sceneData?, fileData? }
// Solo funciona para sourceType === 'editor'

router.patch('/:id', express.json({ limit: '140mb' }), async (req, res) => {
    try {
        const doc = await CombatMap.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Mapa no encontrado' });
        if (doc.sourceType !== 'editor') {
            return res.status(400).json({ error: 'Solo se pueden editar mapas creados desde el editor' });
        }

        const { name, sceneData, fileData, filename: originalName } = req.body;

        if (name) doc.name = name.trim();
        if (sceneData !== undefined) doc.sceneData = sceneData;

        // Si se envía nueva imagen (thumbnail del canvas exportado)
        if (fileData && fileData.startsWith('data:')) {
            // Eliminar archivo antiguo si existe
            if (doc.filename) {
                const oldPath = path.join(MAPS_DIR, doc.filename);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            const fileInfo = saveBase64File(fileData, originalName || doc.name || 'mapa');
            doc.filename = fileInfo.filename;
            doc.url      = fileInfo.url;
            doc.isVideo  = false;
        }

        doc.markModified('sceneData');
        await doc.save();
        res.json(doc);
    } catch (err) {
        console.error('[PATCH /api/combat-maps/:id]', err);
        res.status(500).json({ error: 'Error actualizando mapa', detail: err.message });
    }
});

// ─── DELETE /api/combat-maps/:id — elimina un mapa de DB y disco ──────────────

router.delete('/:id', async (req, res) => {
    try {
        const doc = await CombatMap.findByIdAndDelete(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Mapa no encontrado' });

        if (doc.filename) {
            const filepath = path.join(MAPS_DIR, doc.filename);
            if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        }

        res.json({ ok: true });
    } catch (err) {
        console.error('[DELETE /api/combat-maps]', err);
        res.status(500).json({ error: 'Error eliminando mapa', detail: err.message });
    }
});

module.exports = router;
