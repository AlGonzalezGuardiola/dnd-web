const mongoose = require('mongoose');

// Stores the full character data object for principal player characters.
// Using Mixed type to accommodate the complex, evolving character data structure.
const PlayerCharacterSchema = new mongoose.Schema({
    charId: { type: String, required: true, unique: true },
    data:   { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

module.exports = mongoose.model('PlayerCharacter', PlayerCharacterSchema);
