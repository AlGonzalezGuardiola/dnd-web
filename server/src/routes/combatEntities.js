const express      = require('express');
const router       = express.Router();
const CombatEntity = require('../models/CombatEntity');
const Combat       = require('../models/Combat');

// POST /api/combat-entities  — persist a new ally or enemy created mid-combat
router.post('/', async (req, res) => {
    try {
        const { name, type, stats, actions, combatId, sessionId } = req.body;

        if (!name || !type) {
            return res.status(400).json({ error: 'name y type son obligatorios' });
        }

        const entity = new CombatEntity({
            name,
            type,
            stats:     stats     || { hp: 10, ac: 10, initiative: 0 },
            actions:   actions   || [],
            combatId:  combatId  || null,
            sessionId: sessionId || '',
        });
        await entity.save();

        // Also push the entity ID into the parent combat document (if provided)
        if (combatId) {
            await Combat.findByIdAndUpdate(combatId, { $push: { entities: entity._id } });
        }

        res.status(201).json({ success: true, entityId: entity._id });
    } catch (err) {
        console.error('[combat-entities] POST error:', err.message);
        res.status(500).json({ error: 'Error al guardar la entidad', detail: err.message });
    }
});

// GET /api/combat-entities?combatId=xxx  — fetch all entities for a combat
router.get('/', async (req, res) => {
    try {
        const filter = {};
        if (req.query.combatId) filter.combatId = req.query.combatId;
        if (req.query.sessionId) filter.sessionId = req.query.sessionId;
        const entities = await CombatEntity.find(filter).sort({ createdAt: 1 });
        res.json({ success: true, entities });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
