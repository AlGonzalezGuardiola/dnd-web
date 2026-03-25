const express          = require('express');
const router           = express.Router();
const NarrativeSession = require('../models/NarrativeSession');

// GET /api/narrative-sessions — all sessions, sorted by number asc
router.get('/', async (_req, res) => {
    try {
        const sessions = await NarrativeSession.find().sort({ number: 1 });
        res.json({ success: true, sessions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/narrative-sessions — create or update by clientId (upsert)
router.post('/', async (req, res) => {
    try {
        const { clientId, number, title, sessionDate, summary, content, tags, createdAt, updatedAt } = req.body;
        if (!clientId) return res.status(400).json({ error: 'clientId es obligatorio' });
        if (!number)   return res.status(400).json({ error: 'number es obligatorio' });

        const session = await NarrativeSession.findOneAndUpdate(
            { clientId },
            { $set: {
                number,
                title:       title       || 'Sin título',
                sessionDate: sessionDate || '',
                summary:     summary     || '',
                content:     content     || '',
                tags:        tags        || [],
                createdAt:   createdAt   || new Date(),
                updatedAt:   updatedAt   || new Date(),
            }},
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.status(201).json({ success: true, session });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/narrative-sessions/:clientId
router.delete('/:clientId', async (req, res) => {
    try {
        const deleted = await NarrativeSession.findOneAndDelete({ clientId: req.params.clientId });
        if (!deleted) return res.status(404).json({ error: 'Sesión no encontrada' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
