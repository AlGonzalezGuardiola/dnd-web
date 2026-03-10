require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const combatsRouter         = require('./routes/combats');
const combatEntitiesRouter  = require('./routes/combatEntities');
const entityTemplatesRouter = require('./routes/entityTemplates');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '2mb' }));  // combat state can be large with full log

// ── Health check (ambas rutas: directa y via proxy Apache /api/health) ────────
const health = (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() });
app.get('/health',     health);
app.get('/api/health', health);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/combats',           combatsRouter);
app.use('/api/combat-entities',   combatEntitiesRouter);
app.use('/api/entity-templates',  entityTemplatesRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

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
