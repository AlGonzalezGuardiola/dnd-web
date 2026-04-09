// ============================================================
// worldMap.js — Configuración del Mapa del Mundo interactivo
// GET  /api/world-map          → carga config (hotspots)
// PUT  /api/world-map          → guarda config (hotspots)
// POST /api/world-map/upload   → sube imagen de mapa detalle
// ============================================================

const express         = require('express');
const router          = express.Router();
const fs              = require('fs');
const path            = require('path');
const WorldMapConfig  = require('../models/WorldMapConfig');

const MAPS_DIR     = path.join(__dirname, '../../../web/assets/mapas-mundo');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MIME_TO_EXT  = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_BYTES    = 20 * 1024 * 1024; // 20 MB

function ensureDir() {
    if (!fs.existsSync(MAPS_DIR)) fs.mkdirSync(MAPS_DIR, { recursive: true });
}

function sanitizeFilename(original, mime) {
    const ext  = MIME_TO_EXT[mime] || '.jpg';
    const base = path.basename(original, path.extname(original))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'mapa';
    return `${Date.now()}-${base}${ext}`;
}

// GET /api/world-map
router.get('/', async (_req, res) => {
    try {
        const config = await WorldMapConfig.findOne({ _singleton: 'main' });
        res.json({ hotspots: config?.hotspots ?? [] });
    } catch (err) {
        console.error('[GET /api/world-map]', err);
        res.status(500).json({ error: 'Error cargando mapa', detail: err.message });
    }
});

// PUT /api/world-map  — { hotspots: [...] }
router.put('/', async (req, res) => {
    try {
        const { hotspots } = req.body;
        if (!Array.isArray(hotspots)) {
            return res.status(400).json({ error: 'hotspots debe ser un array' });
        }

        // Validate each hotspot minimally
        for (const hs of hotspots) {
            if (!hs.id || !hs.label || hs.x == null || hs.y == null) {
                return res.status(400).json({ error: 'Hotspot incompleto: falta id, label, x o y' });
            }
        }

        const config = await WorldMapConfig.findOneAndUpdate(
            { _singleton: 'main' },
            { $set: { hotspots } },
            { upsert: true, new: true }
        );
        res.json({ hotspots: config.hotspots });
    } catch (err) {
        console.error('[PUT /api/world-map]', err);
        res.status(500).json({ error: 'Error guardando mapa', detail: err.message });
    }
});

// POST /api/world-map/upload  — { filename, fileData (data URI) }
router.post('/upload', async (req, res) => {
    try {
        const { filename: originalName, fileData } = req.body;

        if (!fileData?.startsWith('data:')) {
            return res.status(400).json({ error: 'Datos de imagen inválidos' });
        }

        const match = fileData.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return res.status(400).json({ error: 'Formato de imagen inválido' });

        const [, mime, b64] = match;
        if (!ALLOWED_MIME.has(mime)) {
            return res.status(400).json({ error: 'Solo se permiten imágenes JPG, PNG o WebP' });
        }

        const buffer = Buffer.from(b64, 'base64');
        if (buffer.length > MAX_BYTES) {
            return res.status(400).json({ error: 'La imagen supera los 20 MB' });
        }

        ensureDir();
        const filename = sanitizeFilename(originalName || 'mapa', mime);
        fs.writeFileSync(path.join(MAPS_DIR, filename), buffer);

        res.status(201).json({
            filename,
            url: `assets/mapas-mundo/${filename}`,
        });
    } catch (err) {
        console.error('[POST /api/world-map/upload]', err);
        res.status(500).json({ error: 'Error subiendo imagen', detail: err.message });
    }
});

module.exports = router;
