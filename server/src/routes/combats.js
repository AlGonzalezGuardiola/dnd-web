const express = require('express');
const router  = express.Router();
const Combat  = require('../models/Combat');

// ── POST /api/combats ─────────────────────────────────────────────────────
// Creates a new combat session.
// Body: { participants, round, log, currentIndex, ... } (full combatState shape)
// Returns: { combatId, combat }
router.post('/', async (req, res) => {
    try {
        const body = req.body;

        // Split participants into role buckets for convenience queries
        const participants = body.participants || [];
        const players  = participants.filter(p => p.tipo === 'jugador');
        const npcs     = participants.filter(p => p.tipo === 'aliado');
        const enemies  = participants.filter(p => p.tipo === 'enemigo');

        const combat = await Combat.create({
            players,
            npcs,
            enemies,
            participants,
            currentIndex:      body.currentIndex      ?? 0,
            round:             body.round             ?? 1,
            isActive:          body.isActive          ?? true,
            segundaAccionTurn: body.segundaAccionTurn ?? false,
            extraAttackTurn:   body.extraAttackTurn   ?? false,
            nextLogId:         body.nextLogId         ?? 0,
            log:               body.log               ?? [],
            name:              body.name              ?? '',
            createdBy:         body.createdBy         ?? '',
        });

        res.status(201).json({ combatId: combat._id, combat });
    } catch (err) {
        console.error('[POST /api/combats]', err);
        res.status(500).json({ error: 'Error al crear el combate', detail: err.message });
    }
});

// ── GET /api/combats/:id ──────────────────────────────────────────────────
// Returns the full combat state by ID.
router.get('/:id', async (req, res) => {
    try {
        const combat = await Combat.findById(req.params.id).lean();
        if (!combat) return res.status(404).json({ error: 'Combate no encontrado' });
        res.json(combat);
    } catch (err) {
        console.error('[GET /api/combats/:id]', err);
        // CastError = invalid ObjectId format
        if (err.name === 'CastError') return res.status(400).json({ error: 'ID de combate inválido' });
        res.status(500).json({ error: 'Error al obtener el combate', detail: err.message });
    }
});

// ── PUT /api/combats/:id ──────────────────────────────────────────────────
// Full or partial update of a combat state.
// Accepts the same shape as POST body; re-derives role buckets from participants.
router.put('/:id', async (req, res) => {
    try {
        const body = req.body;

        // Re-derive role buckets if participants array is provided
        const update = { ...body };
        if (Array.isArray(body.participants)) {
            update.players  = body.participants.filter(p => p.tipo === 'jugador');
            update.npcs     = body.participants.filter(p => p.tipo === 'aliado');
            update.enemies  = body.participants.filter(p => p.tipo === 'enemigo');
        }

        const combat = await Combat.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true, runValidators: true }
        ).lean();

        if (!combat) return res.status(404).json({ error: 'Combate no encontrado' });
        res.json(combat);
    } catch (err) {
        console.error('[PUT /api/combats/:id]', err);
        if (err.name === 'CastError') return res.status(400).json({ error: 'ID de combate inválido' });
        res.status(500).json({ error: 'Error al actualizar el combate', detail: err.message });
    }
});

// ── DELETE /api/combats/:id ───────────────────────────────────────────────
// Soft-close: marks the combat as inactive instead of deleting.
router.delete('/:id', async (req, res) => {
    try {
        const combat = await Combat.findByIdAndUpdate(
            req.params.id,
            { $set: { isActive: false } },
            { new: true }
        ).lean();
        if (!combat) return res.status(404).json({ error: 'Combate no encontrado' });
        res.json({ message: 'Combate cerrado', combatId: combat._id });
    } catch (err) {
        console.error('[DELETE /api/combats/:id]', err);
        if (err.name === 'CastError') return res.status(400).json({ error: 'ID de combate inválido' });
        res.status(500).json({ error: 'Error al cerrar el combate', detail: err.message });
    }
});

module.exports = router;
