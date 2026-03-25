const express        = require('express');
const router         = express.Router();
const CombatTemplate = require('../models/CombatTemplate');

// GET /api/combat-templates
router.get('/', async (req, res) => {
    try {
        const templates = await CombatTemplate.find().sort({ createdAt: -1 });
        res.json({ success: true, templates });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/combat-templates/:id
router.get('/:id', async (req, res) => {
    try {
        const tpl = await CombatTemplate.findById(req.params.id);
        if (!tpl) return res.status(404).json({ error: 'Plantilla no encontrada' });
        res.json({ success: true, template: tpl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/combat-templates
router.post('/', async (req, res) => {
    try {
        const { name, selectedIds, npcs, initiatives } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'name es obligatorio' });
        const tpl = await CombatTemplate.create({
            name:        name.trim(),
            selectedIds: selectedIds || [],
            npcs:        npcs        || [],
            initiatives: initiatives || {},
        });
        res.status(201).json({ success: true, template: tpl });
    } catch (err) {
        console.error('[combat-templates] POST error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/combat-templates/:id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await CombatTemplate.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Plantilla no encontrada' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
