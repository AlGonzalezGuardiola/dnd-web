const express = require('express');
const router  = express.Router();
const Combat  = require('../models/Combat');

// ── In-memory SSE client registry ────────────────────────────────────────────
// combatId (string) → Set<res>
const sseClients = new Map();

function broadcast(combatId, payload) {
    const clients = sseClients.get(String(combatId));
    if (!clients?.size) return;
    const msg = `data: ${JSON.stringify(payload)}\n\n`;
    clients.forEach(res => { try { res.write(msg); } catch (_) {} });
}

// ── POST /api/combats ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const body = req.body;
        const participants = body.participants || [];

        const combat = await Combat.create({
            players:           participants.filter(p => p.tipo === 'jugador'),
            npcs:              participants.filter(p => p.tipo === 'aliado'),
            enemies:           participants.filter(p => p.tipo === 'enemigo'),
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

// ── GET /api/combats/:id/stream — SSE real-time feed ─────────────────────────
router.get('/:id/stream', async (req, res) => {
    try {
        const combat = await Combat.findById(req.params.id).lean();
        if (!combat) return res.status(404).json({ error: 'Combate no encontrado' });

        // SSE headers
        res.setHeader('Content-Type',  'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection',    'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
        res.flushHeaders();

        // Push current state immediately so the client is in sync
        res.write(`data: ${JSON.stringify(combat)}\n\n`);

        // Register client
        const id = String(req.params.id);
        if (!sseClients.has(id)) sseClients.set(id, new Set());
        sseClients.get(id).add(res);

        // Heartbeat every 20 s to prevent load-balancer / proxy timeouts
        const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) {} }, 20000);

        req.on('close', () => {
            clearInterval(hb);
            sseClients.get(id)?.delete(res);
        });
    } catch (err) {
        console.error('[GET /api/combats/:id/stream]', err);
        if (err.name === 'CastError') return res.status(400).json({ error: 'ID inválido' });
        res.status(500).json({ error: 'Error en stream', detail: err.message });
    }
});

// ── GET /api/combats/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const combat = await Combat.findById(req.params.id).lean();
        if (!combat) return res.status(404).json({ error: 'Combate no encontrado' });
        res.json(combat);
    } catch (err) {
        console.error('[GET /api/combats/:id]', err);
        if (err.name === 'CastError') return res.status(400).json({ error: 'ID de combate inválido' });
        res.status(500).json({ error: 'Error al obtener el combate', detail: err.message });
    }
});

// ── PUT /api/combats/:id ──────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const body   = req.body;
        const update = { ...body };
        delete update._clientId; // don't persist the sender's client ID

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

        // Broadcast to all SSE listeners for this combat (include sender's clientId
        // so they can ignore their own echo)
        broadcast(req.params.id, { ...combat, _clientId: body._clientId });

        res.json(combat);
    } catch (err) {
        console.error('[PUT /api/combats/:id]', err);
        if (err.name === 'CastError') return res.status(400).json({ error: 'ID de combate inválido' });
        res.status(500).json({ error: 'Error al actualizar el combate', detail: err.message });
    }
});

// ── DELETE /api/combats/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const combat = await Combat.findByIdAndUpdate(
            req.params.id,
            { $set: { isActive: false } },
            { new: true }
        ).lean();
        if (!combat) return res.status(404).json({ error: 'Combate no encontrado' });
        broadcast(req.params.id, { ...combat, _clientId: null });
        res.json({ message: 'Combate cerrado', combatId: combat._id });
    } catch (err) {
        console.error('[DELETE /api/combats/:id]', err);
        if (err.name === 'CastError') return res.status(400).json({ error: 'ID de combate inválido' });
        res.status(500).json({ error: 'Error al cerrar el combate', detail: err.message });
    }
});

module.exports = router;
