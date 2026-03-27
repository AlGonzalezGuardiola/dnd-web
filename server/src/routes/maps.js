// ============================================
// Maps — lista los mapas de combate disponibles
// en web/assets/mapas/ para el selector del setup
// ============================================

const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');

const MAPS_DIR = path.join(__dirname, '../../../web/assets/mapas');
const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

// GET /api/maps — lista los ficheros de imagen en web/assets/mapas/
router.get('/', (_req, res) => {
    try {
        if (!fs.existsSync(MAPS_DIR)) {
            return res.json([]);
        }
        const files = fs.readdirSync(MAPS_DIR)
            .filter(f => IMG_EXTS.has(path.extname(f).toLowerCase()))
            .map(f => ({
                filename: f,
                url:      `assets/mapas/${f}`,
                name:     path.basename(f, path.extname(f))
                              .replace(/[-_]/g, ' ')
                              .replace(/\b\w/g, c => c.toUpperCase()),
            }));
        res.json(files);
    } catch (err) {
        console.error('[GET /api/maps]', err);
        res.status(500).json({ error: 'Error leyendo mapas', detail: err.message });
    }
});

module.exports = router;
