const express         = require('express');
const router          = express.Router();
const PlayerCharacter = require('../models/PlayerCharacter');

// GET /api/player-characters — return all saved player characters
router.get('/', async (req, res) => {
    try {
        const chars = await PlayerCharacter.find({}).lean();
        res.json({ success: true, characters: chars });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/player-characters/:charId — upsert full character data blob
router.put('/:charId', async (req, res) => {
    try {
        const { data } = req.body;
        if (!data) return res.status(400).json({ error: 'data es obligatorio' });

        const char = await PlayerCharacter.findOneAndUpdate(
            { charId: req.params.charId },
            { $set: { data } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.json({ success: true, charId: char.charId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
