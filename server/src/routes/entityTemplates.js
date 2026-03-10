const express        = require('express');
const router         = express.Router();
const EntityTemplate = require('../models/EntityTemplate');

// POST /api/entity-templates  — upsert by (name + type)
// Called whenever a new ally/enemy is created so it becomes reusable.
router.post('/', async (req, res) => {
    try {
        const { name, type, stats, actions, isGroup, groupSize, isSummon, summoner } = req.body;

        if (!name || !type) {
            return res.status(400).json({ error: 'name y type son obligatorios' });
        }

        // Upsert: update if (name, type) already exists, create otherwise
        const template = await EntityTemplate.findOneAndUpdate(
            { name, type },
            {
                $set: {
                    stats:     stats     || { hp: 10, ac: 10 },
                    actions:   actions   || [],
                    isGroup:   !!isGroup,
                    groupSize: isGroup ? (groupSize || 2) : 1,
                    isSummon:  !!isSummon,
                    summoner:  summoner || '',
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.status(201).json({ success: true, templateId: template._id });
    } catch (err) {
        console.error('[entity-templates] POST error:', err.message);
        res.status(500).json({ error: 'Error al guardar la plantilla', detail: err.message });
    }
});

// GET /api/entity-templates  — list all templates (for future NPC picker UI)
// Supports ?type=ALLY|ENEMY filtering.
router.get('/', async (req, res) => {
    try {
        const filter = {};
        if (req.query.type) filter.type = req.query.type;
        const templates = await EntityTemplate.find(filter).sort({ name: 1 });
        res.json({ success: true, templates });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
