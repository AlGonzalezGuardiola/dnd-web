// ============================================================
// narrativeImages.js — Imágenes de la sección narrativa
// Upload via base64 JSON (imágenes hasta 15 MB)
// ============================================================

const express        = require('express');
const router         = express.Router();
const fs             = require('fs');
const path           = require('path');
const NarrativeImage = require('../models/NarrativeImage');

const IMAGES_DIR = path.join(__dirname, '../../../web/assets/imagenes');

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MIME_TO_EXT   = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const MAX_BYTES     = 15 * 1024 * 1024;

function ensureDir() {
    if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

function sanitizeFilename(original, mime) {
    const ext  = MIME_TO_EXT[mime] || path.extname(original).toLowerCase() || '.jpg';
    const base = path.basename(original, path.extname(original))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'imagen';
    return `${Date.now()}-${base}${ext}`;
}

// GET /api/narrative-images
router.get('/', async (_req, res) => {
    try {
        const images = await NarrativeImage.find().sort({ createdAt: -1 });
        res.json(images);
    } catch (err) {
        console.error('[GET /api/narrative-images]', err);
        res.status(500).json({ error: 'Error obteniendo imágenes', detail: err.message });
    }
});

// POST /api/narrative-images — { name, filename, fileData, description? }
router.post('/', async (req, res) => {
    try {
        const { name, filename: originalName, fileData, description = '' } = req.body;

        if (!name?.trim())                      return res.status(400).json({ error: 'El nombre es obligatorio' });
        if (!fileData?.startsWith('data:'))     return res.status(400).json({ error: 'Datos de archivo inválidos' });

        const match = fileData.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return res.status(400).json({ error: 'Formato de archivo inválido' });

        const [, mime, b64] = match;
        if (!ALLOWED_MIMES.has(mime)) return res.status(400).json({ error: 'Solo se permiten imágenes JPG, PNG, WebP o GIF' });

        const buffer = Buffer.from(b64, 'base64');
        if (buffer.length > MAX_BYTES) return res.status(400).json({ error: 'La imagen supera los 15 MB' });

        ensureDir();
        const filename = sanitizeFilename(originalName || 'imagen', mime);
        fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer);

        const doc = await NarrativeImage.create({
            name: name.trim(),
            filename,
            url: `assets/imagenes/${filename}`,
            description: description.trim(),
        });

        res.status(201).json(doc);
    } catch (err) {
        console.error('[POST /api/narrative-images]', err);
        res.status(500).json({ error: 'Error subiendo imagen', detail: err.message });
    }
});

// DELETE /api/narrative-images/:id
router.delete('/:id', async (req, res) => {
    try {
        const doc = await NarrativeImage.findByIdAndDelete(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Imagen no encontrada' });

        const filepath = path.join(IMAGES_DIR, doc.filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

        res.json({ ok: true });
    } catch (err) {
        console.error('[DELETE /api/narrative-images]', err);
        res.status(500).json({ error: 'Error eliminando imagen', detail: err.message });
    }
});

module.exports = router;
