const express      = require('express');
const router       = express.Router();
const CombatEntity = require('../models/CombatEntity');
const Combat       = require('../models/Combat');

// POST /api/combat-entities  — persist a new ally or enemy created mid-combat
router.post('/', async (req, res) => {
    try {
        const {
            name, type, stats, actions,
            combatId, sessionId,
            // Group fields
            isGroup, groupSize, membersRemaining, hpPerMember, totalHp, currentMemberHp,
            // Summon fields
            isSummon, summoner, summonedBeforeCombat,
        } = req.body;

        if (!name || !type) {
            return res.status(400).json({ error: 'name y type son obligatorios' });
        }

        // ── Zero one-summon rule ──────────────────────────────────────────────────
        if (isSummon && summoner === 'ZERO' && combatId) {
            const existing = await CombatEntity.findOne({
                combatId,
                isSummon: true,
                summoner: 'ZERO',
            });
            if (existing) {
                return res.status(400).json({
                    error: 'Zero ya tiene una invocación activa en este combate',
                    code:  'ZERO_SUMMON_LIMIT',
                });
            }
        }

        const entity = new CombatEntity({
            name,
            type,
            stats:     stats     || { hp: 10, ac: 10, initiative: 0 },
            actions:   actions   || [],
            combatId:  combatId  || null,
            sessionId: sessionId || '',
            // Group
            isGroup:          !!isGroup,
            groupSize:        groupSize        ?? 1,
            membersRemaining: membersRemaining ?? (groupSize ?? 1),
            hpPerMember:      hpPerMember      ?? (stats?.hp ?? 10),
            totalHp:          totalHp          ?? (stats?.hp ?? 10),
            currentMemberHp:  currentMemberHp  ?? (stats?.hp ?? 10),
            // Summon
            isSummon:             !!isSummon,
            summoner:             summoner             || '',
            summonedBeforeCombat: !!summonedBeforeCombat,
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
        if (req.query.combatId)  filter.combatId  = req.query.combatId;
        if (req.query.sessionId) filter.sessionId = req.query.sessionId;
        const entities = await CombatEntity.find(filter).sort({ createdAt: 1 });
        res.json({ success: true, entities });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
