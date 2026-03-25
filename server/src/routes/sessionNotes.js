const express     = require('express');
const router      = express.Router();
const SessionNote = require('../models/SessionNote');

// GET /api/session-notes — list all notes, sorted newest first
router.get('/', async (_req, res) => {
    try {
        const notes = await SessionNote.find().sort({ updatedAt: -1 });
        res.json({ success: true, notes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/session-notes — create or update by clientId (upsert)
router.post('/', async (req, res) => {
    try {
        const { clientId, title, tag, content, createdAt, updatedAt } = req.body;
        if (!clientId) return res.status(400).json({ error: 'clientId es obligatorio' });

        const note = await SessionNote.findOneAndUpdate(
            { clientId },
            { $set: { title: title || 'Sin título', tag: tag || '', content: content || '',
                      createdAt: createdAt || new Date(), updatedAt: updatedAt || new Date() } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.status(201).json({ success: true, note });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/session-notes/:clientId — update existing note
router.put('/:clientId', async (req, res) => {
    try {
        const { title, tag, content, updatedAt } = req.body;
        const note = await SessionNote.findOneAndUpdate(
            { clientId: req.params.clientId },
            { $set: { title: title || 'Sin título', tag: tag || '', content: content || '',
                      updatedAt: updatedAt || new Date() } },
            { new: true }
        );
        if (!note) return res.status(404).json({ error: 'Nota no encontrada' });
        res.json({ success: true, note });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/session-notes/:clientId — delete a note
router.delete('/:clientId', async (req, res) => {
    try {
        const deleted = await SessionNote.findOneAndDelete({ clientId: req.params.clientId });
        if (!deleted) return res.status(404).json({ error: 'Nota no encontrada' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
