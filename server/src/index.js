require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');

const combatsRouter           = require('./routes/combats');
const combatEntitiesRouter    = require('./routes/combatEntities');
const entityTemplatesRouter   = require('./routes/entityTemplates');
const playerCharactersRouter  = require('./routes/playerCharacters');
const combatTemplatesRouter   = require('./routes/combatTemplates');
const sessionNotesRouter      = require('./routes/sessionNotes');
const narrativeSessionsRouter = require('./routes/narrativeSessions');
const mapsRouter              = require('./routes/maps');
const combatMapsRouter        = require('./routes/combatMaps');
const narrativeImagesRouter   = require('./routes/narrativeImages');
const worldMapRouter          = require('./routes/worldMap');
const mundo3dRouter           = require('./routes/mundo3d');
const charModelsRouter        = require('./routes/charModels');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '140mb' }));  // combat-maps upload can be up to 100 MB video (base64 +33%)

// ── Health check (ambas rutas: directa y via proxy Apache /api/health) ────────
const health = (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() });
app.get('/health',     health);
app.get('/api/health', health);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/combats',             combatsRouter);
app.use('/api/combat-entities',     combatEntitiesRouter);
app.use('/api/entity-templates',    entityTemplatesRouter);
app.use('/api/player-characters',   playerCharactersRouter);
app.use('/api/combat-templates',    combatTemplatesRouter);
app.use('/api/session-notes',       sessionNotesRouter);
app.use('/api/narrative-sessions',  narrativeSessionsRouter);
app.use('/api/maps',                mapsRouter);
app.use('/api/combat-maps',         combatMapsRouter);
app.use('/api/narrative-images',    narrativeImagesRouter);
app.use('/api/world-map',           worldMapRouter);
app.use('/api/mundo3d',             mundo3dRouter);
app.use('/api/char-models',         charModelsRouter);

// ── Static files (web/) + SPA fallback ───────────────────────────────────────
const WEB_DIR = path.join(__dirname, '../../web');
app.use(express.static(WEB_DIR));

// For any non-API path that doesn't match a static file, serve index.html
// so that browser refreshes on SPA "pages" don't get a 404.
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    res.sendFile(path.join(WEB_DIR, 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('[Unhandled error]', err);
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
});

// ── MongoDB connection + server start ─────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error('❌  MONGO_URI no definida. Crea un archivo server/.env con MONGO_URI=...');
    process.exit(1);
}

mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log('✅  MongoDB conectado');
        app.listen(PORT, () => console.log(`🚀  Servidor en http://localhost:${PORT}`));
    })
    .catch(err => {
        console.error('❌  Error conectando a MongoDB:', err.message);
        process.exit(1);
    });
