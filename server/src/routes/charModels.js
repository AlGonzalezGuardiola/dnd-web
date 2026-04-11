// ============================================================
// charModels.js — Modelos GLB 3D por personaje
// Upload via base64 JSON (misma convención que narrativeImages)
// ============================================================

const express   = require('express');
const router    = express.Router();
const fs        = require('fs');
const path      = require('path');
const CharModel = require('../models/CharModel');

const MODELS_DIR = path.join(__dirname, '../../../web/assets/models3d');
const MAX_BYTES  = 100 * 1024 * 1024; // 100 MB

function ensureDir() {
    if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });
}

// GET /api/char-models/:charId — devuelve { url, filename } o 404
router.get('/:charId', async (req, res) => {
    try {
        const doc = await CharModel.findOne({ charId: req.params.charId });
        if (!doc) return res.status(404).json({ error: 'Sin modelo' });
        res.json({ url: doc.url, filename: doc.filename });
    } catch (err) {
        console.error('[GET /api/char-models]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/char-models — { charId, filename, fileData (data URI base64) }
router.post('/', async (req, res) => {
    try {
        const { charId, filename: originalName = 'model.glb', fileData } = req.body;

        if (!charId?.trim())              return res.status(400).json({ error: 'charId requerido' });
        if (!fileData?.startsWith('data:')) return res.status(400).json({ error: 'fileData inválido (se esperaba data URI)' });

        // Decodificar base64
        const base64 = fileData.replace(/^data:[^;]*;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');
        if (buffer.length > MAX_BYTES) {
            return res.status(413).json({ error: `Modelo demasiado grande (máx ${MAX_BYTES / 1024 / 1024} MB)` });
        }

        ensureDir();

        // Borrar archivo anterior si existe
        const existing = await CharModel.findOne({ charId });
        if (existing) {
            const oldPath = path.join(MODELS_DIR, existing.filename);
            if (fs.existsSync(oldPath)) { try { fs.unlinkSync(oldPath); } catch (_) {} }
        }

        // Guardar nuevo archivo
        const safeId   = charId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
        const filename = `${safeId}-${Date.now()}.glb`;
        fs.writeFileSync(path.join(MODELS_DIR, filename), buffer);

        const url = `/assets/models3d/${filename}`;
        await CharModel.findOneAndUpdate(
            { charId },
            { charId, filename, url },
            { upsert: true, new: true }
        );

        console.log(`[charModels] Guardado: ${filename} (${(buffer.length / 1024).toFixed(0)} KB)`);
        res.json({ url, filename });
    } catch (err) {
        console.error('[POST /api/char-models]', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/char-models/:charId
router.delete('/:charId', async (req, res) => {
    try {
        const doc = await CharModel.findOneAndDelete({ charId: req.params.charId });
        if (doc) {
            const filePath = path.join(MODELS_DIR, doc.filename);
            if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch (_) {} }
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('[DELETE /api/char-models]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
