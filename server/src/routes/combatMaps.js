// ============================================
// Combat Maps — gestión de mapas de combate
// Almacena metadatos en MongoDB + imagen en disco (web/assets/mapas/)
// Upload via base64 JSON (sin multer)
// ============================================

const express   = require('express');
const router    = express.Router();
const fs        = require('fs');
const path      = require('path');
const CombatMap = require('../models/CombatMap');

const MAPS_DIR  = path.join(__dirname, '../../../web/assets/mapas');
const IMG_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const IMG_EXTS  = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

function ensureMapsDir() {
    if (!fs.existsSync(MAPS_DIR)) fs.mkdirSync(MAPS_DIR, { recursive: true });
}

function sanitizeFilename(original) {
    const ext  = path.extname(original).toLowerCase() || '.jpg';
    const base = path.basename(original, path.extname(original))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'mapa';
    return `${Date.now()}-${base}${ext}`;
}

// GET /api/combat-maps — lista todos los mapas guardados en DB
router.get('/', async (_req, res) => {
    try {
        const maps = await CombatMap.find().sort({ createdAt: -1 });
        res.json(maps);
    } catch (err) {
        console.error('[GET /api/combat-maps]', err);
        res.status(500).json({ error: 'Error obteniendo mapas', detail: err.message });
    }
});

// POST /api/combat-maps — sube un nuevo mapa (base64 en JSON)
// Body: { name: string, filename: string, fileData: "data:image/...;base64,..." }
router.post('/', express.json({ limit: '15mb' }), async (req, res) => {
    try {
        const { name, filename: originalName, fileData } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }
        if (!fileData || !fileData.startsWith('data:')) {
            return res.status(400).json({ error: 'Datos de imagen inválidos' });
        }

        // Parse data URL: data:<mime>;base64,<data>
        const match = fileData.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
            return res.status(400).json({ error: 'Formato de imagen inválido' });
        }
        const [, mime, b64] = match;
        if (!IMG_MIMES.has(mime)) {
            return res.status(400).json({ error: 'Tipo de imagen no permitido (usa JPG, PNG, WebP o GIF)' });
        }

        const buffer = Buffer.from(b64, 'base64');
        if (buffer.length > 15 * 1024 * 1024) {
            return res.status(400).json({ error: 'La imagen supera los 15 MB' });
        }

        ensureMapsDir();
        const filename = sanitizeFilename(originalName || `mapa${IMG_EXTS[mime] || '.jpg'}`);
        const filepath = path.join(MAPS_DIR, filename);
        fs.writeFileSync(filepath, buffer);

        const url = `assets/mapas/${filename}`;
        const doc = await CombatMap.create({ name: name.trim(), filename, url });

        res.status(201).json(doc);
    } catch (err) {
        console.error('[POST /api/combat-maps]', err);
        res.status(500).json({ error: 'Error subiendo mapa', detail: err.message });
    }
});

// DELETE /api/combat-maps/:id — elimina un mapa de DB y disco
router.delete('/:id', async (req, res) => {
    try {
        const doc = await CombatMap.findByIdAndDelete(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Mapa no encontrado' });

        const filepath = path.join(MAPS_DIR, doc.filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

        res.json({ ok: true });
    } catch (err) {
        console.error('[DELETE /api/combat-maps]', err);
        res.status(500).json({ error: 'Error eliminando mapa', detail: err.message });
    }
});

module.exports = router;
