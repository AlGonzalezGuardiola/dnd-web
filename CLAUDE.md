# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow

After completing any change (feature, fix, refactor), always commit and push to GitHub automatically — no need to ask the user.

## Project Overview

A D&D 5e combat management web application (Spanish-language UI) with interactive map navigation, character sheet management, and multi-device collaborative combat sessions.

## Development Commands

### Backend Server
```bash
cd server
npm run dev      # Start with nodemon (hot-reload)
npm start        # Start without hot-reload
```

### Environment Setup
Copy `server/.env.example` to `server/.env` and fill in MongoDB credentials:
```
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/dnd?retryWrites=true&w=majority
PORT=3001
```

### Frontend
No build step — serve `web/` as static files. The frontend auto-detects localhost vs production for API base URL.

## Architecture

### Stack
- **Frontend:** Vanilla JS/HTML/CSS (no framework, no bundler)
- **Backend:** Node.js + Express 4 + Mongoose 8 + MongoDB
- **Real-time:** Server-Sent Events (SSE) for multi-device sync

### Directory Layout
```
server/src/
  index.js              # Express entry point (2MB JSON limit, CORS)
  models/               # Mongoose schemas: Combat, CombatEntity, EntityTemplate
  routes/               # combats.js, combatEntities.js, entityTemplates.js

web/
  index.html            # SPA entry point
  script.js             # Main app logic (~5,300 lines)
  characters.js         # All character definitions (window.characterData)
  data.js               # Map/world data (window.initialGameData)
  style.css / mobile.css
  m_*.html / m_script.js / m_*.css   # Mobile-specific pages
```

### Frontend State Architecture
State is split across several global objects in `script.js`:

| Object | Purpose |
|---|---|
| `state` | Map navigation, zoom/pan, edit mode, pin data |
| `combatState` | Participants, turn index, round number, action log |
| `hpState`, `spellSlotState`, etc. | Per-character persistent state |

Character/map data is embedded in JS files as `window.characterData` and `window.initialGameData` — not fetched from API.

### Multi-Device Sync Flow
1. One device creates a combat session → server returns `combatId` + 6-char `joinCode`
2. Other devices join via `joinCode`
3. All state changes PUT to `/api/combats/:id` (debounced 800ms, or immediate for critical actions)
4. Server broadcasts via SSE to all connected clients
5. Clients skip applying updates they originated (matched by `_clientId`)

### API Routes
- `POST /api/combats` — create session
- `POST /api/combats/join` — join by code
- `POST /api/combats/:id/start` — begin combat
- `PUT /api/combats/:id` — sync state (debounced or immediate)
- `GET /api/combats/:id/stream` — SSE endpoint
- `CRUD /api/combat-entities` — NPC instances
- `CRUD /api/entity-templates` — reusable NPC templates

### localStorage Keys
`dnd_combat_id`, `dnd_role`, `dnd_hp`, `dnd_slots`, `dnd_inspiration`, `dnd_conditions`, `dnd_deathsaves`, `dnd_demonic`, `dnd_notes`

## Key Patterns

- **Immediate vs debounced saves:** Most state changes use an 800ms debounce. The "Anterior" (previous turn) button bypasses this to avoid SSE race conditions.
- **API base URL:** `script.js` auto-selects `http://localhost:3001` on localhost, or `window.location.origin` in production (backend served from same origin).
- **No tests exist** in this project currently.
