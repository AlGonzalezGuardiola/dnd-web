// ============================================================
// mundo3d.js — POIs y escenas para el visor 3D del mundo
// GET  /api/mundo3d?sceneId=<id>      → carga escena y POIs
// PUT  /api/mundo3d                   → guarda { sceneId, sceneType, hotspots }
// POST /api/mundo3d/upload            → sube imagen (image) o modelo (glb)
// ============================================================

const express       = require('express');
const router        = express.Router();
const fs            = require('fs');
const path          = require('path');
const Mundo3DConfig = require('../models/Mundo3DConfig');

const MAPS_DIR  = path.join(__dirname, '../../../web/assets/mapas-mundo');
const GLBS_DIR  = path.join(__dirname, '../../../web/assets/3D');

const ALLOWED_IMG_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMG_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_IMG_BYTES = 20  * 1024 * 1024;
const MAX_GLB_BYTES = 200 * 1024 * 1024;

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeBasename(original, fallback) {
    return path.basename(original || fallback, path.extname(original || ''))
        .toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
        .replace(/^-|-$/g, '').slice(0, 60) || fallback;
}

// GET /api/mundo3d?sceneId=m3d_root
router.get('/', async (req, res) => {
    try {
        const sceneId = req.query.sceneId || 'm3d_root';
        const scene   = await Mundo3DConfig.findOne({ sceneId });
        res.json({
            sceneId,
            sceneType: scene?.sceneType ?? 'glb3d',
            hotspots:  scene?.hotspots  ?? [],
        });
    } catch (err) {
        console.error('[GET /api/mundo3d]', err);
        res.status(500).json({ error: 'Error cargando escena', detail: err.message });
    }
});

// PUT /api/mundo3d — { sceneId, sceneType, hotspots }
router.put('/', async (req, res) => {
    try {
        const { sceneId, sceneType, hotspots } = req.body;
        if (!sceneId) return res.status(400).json({ error: 'sceneId requerido' });
        if (!Array.isArray(hotspots)) return res.status(400).json({ error: 'hotspots debe ser un array' });

        for (const hs of hotspots) {
            if (!hs.id || !hs.label) {
                return res.status(400).json({ error: 'Cada POI necesita id y label' });
            }
        }

        const scene = await Mundo3DConfig.findOneAndUpdate(
            { sceneId },
            { $set: { sceneId, sceneType: sceneType || 'glb3d', hotspots } },
            { upsert: true, new: true }
        );
        res.json({ sceneId, sceneType: scene.sceneType, hotspots: scene.hotspots });
    } catch (err) {
        console.error('[PUT /api/mundo3d]', err);
        res.status(500).json({ error: 'Error guardando escena', detail: err.message });
    }
});

// POST /api/mundo3d/upload — { filename, fileData (base64 data-URL), fileType: 'image'|'glb' }
router.post('/upload', async (req, res) => {
    try {
        const { filename: originalName, fileData, fileType } = req.body;
        if (!fileData?.startsWith('data:')) {
            return res.status(400).json({ error: 'fileData inválido (debe ser data-URL)' });
        }

        const match = fileData.match(/^data:([^;]+);base64,(.+)$/s);
        if (!match) return res.status(400).json({ error: 'Formato de data-URL inválido' });

        const [, mime, b64] = match;
        const buffer = Buffer.from(b64, 'base64');

        if (fileType === 'image') {
            if (!ALLOWED_IMG_MIME.has(mime)) {
                return res.status(400).json({ error: 'Solo se aceptan JPG, PNG o WebP' });
            }
            if (buffer.length > MAX_IMG_BYTES) {
                return res.status(400).json({ error: 'La imagen supera los 20 MB' });
            }
            const ext      = IMG_EXT[mime] || '.jpg';
            const base     = safeBasename(originalName, 'imagen');
            const filename = `${Date.now()}-${base}${ext}`;
            ensureDir(MAPS_DIR);
            fs.writeFileSync(path.join(MAPS_DIR, filename), buffer);
            return res.status(201).json({ filename, url: `assets/mapas-mundo/${filename}` });
        }

        if (fileType === 'glb') {
            if (buffer.length > MAX_GLB_BYTES) {
                return res.status(400).json({ error: 'El GLB supera los 200 MB' });
            }
            const base     = safeBasename(originalName, 'modelo');
            const filename = `${Date.now()}-${base}.glb`;
            ensureDir(GLBS_DIR);
            fs.writeFileSync(path.join(GLBS_DIR, filename), buffer);
            return res.status(201).json({ filename, url: `assets/3D/${filename}` });
        }

        return res.status(400).json({ error: 'fileType debe ser "image" o "glb"' });
    } catch (err) {
        console.error('[POST /api/mundo3d/upload]', err);
        res.status(500).json({ error: 'Error subiendo archivo', detail: err.message });
    }
});

module.exports = router;
