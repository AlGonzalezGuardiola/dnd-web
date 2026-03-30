// FILE: web/map-creator.js
// ============================================
// Map Creator — Core: estado de escena, init PixiJS, guardado, descarga
// Depends on: globals.js (API_BASE), view.js (setView), utils.js (showNotification)
// Requires: PixiJS v7 (window.PIXI) cargado antes de este archivo
// ============================================

// ─── Estado del módulo ─────────────────────────────────────────────────────

const _mc = {
    app:      null,  // PIXI.Application
    stage: {
        world:      null,  // PIXI.Container — pan/zoom aquí
        background: null,  // PIXI.Container
        grid:       null,  // PIXI.Graphics
        drawings:   null,  // PIXI.Container (between grid and tiles)
        tiles:      null,  // PIXI.Container
        walls:      null,  // PIXI.Graphics
        doors:      null,  // PIXI.Container
        notes:      null,  // PIXI.Container
        fog:        null,  // PIXI.Graphics
        ui:         null,  // PIXI.Container (selection handles + previews)
        uiHandles:  null,  // PIXI.Graphics — 8 resize + rotation handles
        uiPreview:  null,  // PIXI.Graphics — tool preview (wall chain, draw preview)
    },
    scene:        null,   // Scene data actual
    tool:         'select',
    selection:    null,   // { type, id }
    history:      [],     // Snapshots JSON para undo/redo
    historyIndex: -1,
    modified:     false,
    mapId:        null,   // null = nuevo, string = editando existente
    pan:    { x: 0, y: 0 },
    zoom:   1,
    spaceDown:   false,
    shiftDown:   false,
    isPanning:   false,
    panStart:    { x: 0, y: 0 },
    panStartPos: { x: 0, y: 0 },
    panelTab:    'scene',
    fogBrushSize: 70,
    fogErasing:   false,
    tileToPlace:  null,  // Tile a colocar desde la paleta
    wallDrawing:  null,  // Muro en construcción legacy (drag único)
    wallChain:    null,  // Cadena de muros { lastPoint:{x,y}, previewEnd:{x,y} }
    drawSubTool:  'rect',  // 'rect' | 'ellipse'
    drawFillColor:  0x3a5a8a,
    drawFillAlpha:  0.55,
    drawStrokeColor: 0x7ab3e0,
    drawStrokeWidth: 2,
    drawStart:    null,  // { x, y } — punto de inicio de dibujo
    dragState:    null,  // Drag de objetos seleccionados
    fogPainting:  false,
    initialized:  false,
    resizeObs:    null,
    textureCache: new Map(),
    autoSaveTimer: null,
    mouseWorld: { x: 0, y: 0 }, // posición del ratón en coords mundo
};

// ─── Scene por defecto ─────────────────────────────────────────────────────

function _mcDefaultScene(name) {
    return {
        version:    2,
        name:       name || 'Nuevo mapa',
        background: {
            type:   'color',
            color:  '#1a1a2e',
            url:    '',
            width:  1920,
            height: 1080,
        },
        grid: {
            enabled: true,
            size:    70,
            color:   '#ffffff',
            alpha:   0.12,
        },
        drawings: [],
        tiles: [],
        walls: [],
        doors: [],
        notes: [],
        fog: {
            enabled: false,
            regions: [],
        },
    };
}

// ─── Puntos de entrada ─────────────────────────────────────────────────────

function openMapCreatorHub() {
    setView('mapCreatorHub');
}

function openMapCreator(mapId) {
    if (_mc.initialized && !mapId) _mcNewScene();
    setView('mapCreator');
    if (mapId) {
        setTimeout(() => _mcLoadMap(mapId), 50);
    }
}

// ─── Hub: lista de mapas del editor ───────────────────────────────────────

function initMapCreatorHub() {
    _mcRenderHubGrid();
}

async function _mcRenderHubGrid() {
    const grid = document.getElementById('mcHubGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="mc-hub-loading">Cargando mapas…</div>';

    try {
        const res = await fetch(`${API_BASE}/api/combat-maps`);
        const all = res.ok ? await res.json() : [];
        const editorMaps = all.filter(m => m.sourceType === 'editor');

        if (!editorMaps.length) {
            grid.innerHTML = `
                <div class="mc-hub-empty">
                    <div style="font-size:48px;margin-bottom:12px">🗺️</div>
                    <div>Aún no has creado ningún mapa.<br>Pulsa <strong>Nuevo mapa</strong> para empezar.</div>
                </div>`;
            return;
        }

        grid.innerHTML = editorMaps.map(m => {
            const thumb = m.url
                ? `<img class="mc-hub-thumb" src="${m.url}" alt="${_escHtml(m.name)}"
                        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : '';
            const placeholder = `<div class="mc-hub-thumb-placeholder" style="${m.url ? 'display:none' : ''}">🗺️</div>`;
            return `
                <div class="mc-hub-card" onclick="openMapCreator('${m._id}')">
                    ${thumb}${placeholder}
                    <div class="mc-hub-info">
                        <div class="mc-hub-name">${_escHtml(m.name)}</div>
                        <div class="mc-hub-meta">${new Date(m.updatedAt).toLocaleDateString('es-ES')}</div>
                    </div>
                    <button class="mc-hub-delete-btn"
                            onclick="event.stopPropagation();_mcHubDeleteMap('${m._id}','${_escHtml(m.name)}')"
                            title="Eliminar">🗑</button>
                </div>`;
        }).join('');
    } catch (_) {
        grid.innerHTML = '<div class="mc-hub-empty">Error al cargar mapas.</div>';
    }
}

async function _mcHubDeleteMap(id, name) {
    if (!confirm(`¿Eliminar el mapa "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
        const res = await fetch(`${API_BASE}/api/combat-maps/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || 'Error');
        invalidateCombatMapsCache();
        showNotification('Mapa eliminado', 1800);
        _mcRenderHubGrid();
    } catch (err) {
        showNotification('Error: ' + err.message, 3000);
    }
}

// ─── Editor: init PixiJS ───────────────────────────────────────────────────

function initMapCreator() {
    const wrap = document.getElementById('mcCanvasWrap');
    if (!wrap) return;

    if (typeof PIXI === 'undefined') {
        wrap.innerHTML = `<div style="color:#f87171;padding:32px;text-align:center">
            El motor gráfico (PixiJS) no se ha cargado.<br>
            Verifica tu conexión a internet y recarga la página.</div>`;
        return;
    }

    if (!_mc.initialized) {
        _mcBootPixi(wrap);
        _mc.initialized = true;
    } else {
        if (_mc.app) _mc.app.ticker.start();
        _mcResizeCanvas();
        _mcRenderAll();
        _mcUpdateUI();
    }
}

function _mcBootPixi(wrap) {
    _mc.app = new PIXI.Application({
        resizeTo:    wrap,
        backgroundColor: 0x111118,
        resolution:  window.devicePixelRatio || 1,
        autoDensity: true,
        antialias:   true,
    });

    wrap.appendChild(_mc.app.view);

    // Capas en orden de render
    _mc.stage.world      = new PIXI.Container();
    _mc.stage.background = new PIXI.Container();
    _mc.stage.grid       = new PIXI.Graphics();
    _mc.stage.drawings   = new PIXI.Container();
    _mc.stage.tiles      = new PIXI.Container();
    _mc.stage.walls      = new PIXI.Graphics();
    _mc.stage.doors      = new PIXI.Container();
    _mc.stage.notes      = new PIXI.Container();
    _mc.stage.fog        = new PIXI.Graphics();

    // UI container con dos gráficos hijos
    _mc.stage.ui         = new PIXI.Container();
    _mc.stage.uiHandles  = new PIXI.Graphics();
    _mc.stage.uiPreview  = new PIXI.Graphics();
    _mc.stage.ui.addChild(_mc.stage.uiPreview);
    _mc.stage.ui.addChild(_mc.stage.uiHandles);

    _mc.app.stage.addChild(_mc.stage.world);
    _mc.stage.world.addChild(_mc.stage.background);
    _mc.stage.world.addChild(_mc.stage.grid);
    _mc.stage.world.addChild(_mc.stage.drawings);
    _mc.stage.world.addChild(_mc.stage.tiles);
    _mc.stage.world.addChild(_mc.stage.walls);
    _mc.stage.world.addChild(_mc.stage.doors);
    _mc.stage.world.addChild(_mc.stage.notes);
    _mc.stage.world.addChild(_mc.stage.fog);
    _mc.stage.world.addChild(_mc.stage.ui);

    // Eventos nativos del canvas
    _mc.app.view.addEventListener('wheel',       _mcOnWheel,     { passive: false });
    _mc.app.view.addEventListener('mousedown',   _mcOnMouseDown);
    _mc.app.view.addEventListener('mousemove',   _mcOnMouseMove);
    _mc.app.view.addEventListener('mouseup',     _mcOnMouseUp);
    _mc.app.view.addEventListener('mouseleave',  _mcOnMouseLeave);
    _mc.app.view.addEventListener('dblclick',    _mcOnDblClick);
    _mc.app.view.addEventListener('contextmenu', _mcOnContextMenu);

    document.addEventListener('keydown', _mcOnKeyDown);
    document.addEventListener('keyup',   _mcOnKeyUp);
    document.addEventListener('click',   _mcOnDocClick);

    _mcInitTextures();
    _mcNewScene();
}

function _mcNewScene() {
    _mc.scene        = _mcDefaultScene();
    _mc.mapId        = null;
    _mc.history      = [];
    _mc.historyIndex = -1;
    _mc.modified     = false;
    _mc.selection    = null;
    _mc.pan          = { x: 40, y: 40 };
    _mc.zoom         = 0.5;
    _mc.tool         = 'select';
    _mc.wallDrawing  = null;
    _mc.wallChain    = null;
    _mc.drawStart    = null;
    _mc.tileToPlace  = null;
    _mc.dragState    = null;
    _mc.fogErasing   = false;

    _mcPushHistory();
    _mcApplyViewport();
    _mcRenderAll();
    _mcSyncTopbar();
    _mcUpdateToolbar();
    _mcSyncStatusBar();
    _mcResizeCanvas();
    _mcHideContextMenu();
}

// ─── Texture init ─────────────────────────────────────────────────────────

function _mcInitTextures() {
    // Generate patterned textures for built-in tile types
    const SIZE = 140; // texture size in pixels

    const defs = [
        { key: 'tile:stone', fn: _mcTexStone },
        { key: 'tile:wood',  fn: _mcTexWood  },
        { key: 'tile:water', fn: _mcTexWater },
        { key: 'tile:grass', fn: _mcTexGrass },
        { key: 'tile:sand',  fn: _mcTexSand  },
        { key: 'tile:lava',  fn: _mcTexLava  },
        { key: 'tile:snow',  fn: _mcTexSnow  },
        { key: 'tile:dark',  fn: _mcTexDark  },
        { key: 'tile:dirt',  fn: _mcTexDirt  },
        { key: 'tile:marble',fn: _mcTexMarble},
        { key: 'tile:moss',  fn: _mcTexMoss  },
        { key: 'tile:ice',   fn: _mcTexIce   },
    ];

    for (const { key, fn } of defs) {
        if (_mc.textureCache.has(key)) continue;
        const g = new PIXI.Graphics();
        fn(g, SIZE);
        const tex = _mc.app.renderer.generateTexture(g, {
            scaleMode: PIXI.SCALE_MODES.LINEAR,
            resolution: 1,
            region: new PIXI.Rectangle(0, 0, SIZE, SIZE),
        });
        g.destroy();
        _mc.textureCache.set(key, tex);
    }
}

function _mcTexStone(g, S) {
    // Gray base
    g.beginFill(0x666672, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Stone blocks 2x3
    const bw = S / 2, bh = S / 3;
    g.lineStyle(2, 0x3a3a42, 0.9);
    for (let row = 0; row < 3; row++) {
        const offset = (row % 2) === 0 ? 0 : bw / 2;
        for (let col = -1; col < 3; col++) {
            const x = col * bw + offset, y = row * bh;
            g.drawRect(x + 2, y + 2, bw - 4, bh - 4);
        }
    }
    // Mortar color
    g.lineStyle(2, 0x2a2a30, 0.7);
    for (let row = 0; row <= 3; row++) { g.moveTo(0, row * bh); g.lineTo(S, row * bh); }
    for (let row = 0; row < 3; row++) {
        const offset = (row % 2) === 0 ? 0 : bw / 2;
        for (let col = 0; col <= 3; col++) {
            g.moveTo(col * bw + offset, row * bh);
            g.lineTo(col * bw + offset, (row + 1) * bh);
        }
    }
}

function _mcTexWood(g, S) {
    // Wood base warm brown
    g.beginFill(0x8B5A2B, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Plank lines (horizontal)
    const plankH = S / 5;
    for (let i = 0; i <= 5; i++) {
        g.lineStyle(2, 0x4a2e10, 0.8);
        g.moveTo(0, i * plankH); g.lineTo(S, i * plankH);
    }
    // Grain lines within planks
    for (let row = 0; row < 5; row++) {
        g.lineStyle(1, 0x6a4020, 0.4);
        for (let grainX = 8; grainX < S; grainX += 14) {
            const y = row * plankH + 4;
            g.moveTo(grainX, y);
            g.bezierCurveTo(grainX + 3, y + plankH * 0.3, grainX - 3, y + plankH * 0.7, grainX, y + plankH - 4);
        }
    }
    // Plank vertical separators (staggered)
    g.lineStyle(2, 0x4a2e10, 0.6);
    for (let row = 0; row < 5; row++) {
        const offset = (row % 2) === 0 ? 0 : S / 2;
        g.moveTo(offset, row * plankH); g.lineTo(offset, (row + 1) * plankH);
    }
}

function _mcTexWater(g, S) {
    g.beginFill(0x0d3b6e, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Ripple lines
    for (let i = 0; i < 6; i++) {
        const y = (i / 6) * S + S / 12;
        g.lineStyle(1.5, 0x1a6ea8, 0.5);
        g.moveTo(4, y);
        g.bezierCurveTo(S * 0.25, y - 6, S * 0.5, y + 6, S * 0.75, y - 4);
        g.bezierCurveTo(S * 0.85, y - 6, S - 4, y, S - 4, y);
    }
    // Highlight shimmer dots
    g.lineStyle(0);
    for (let i = 0; i < 8; i++) {
        g.beginFill(0x5bc4f5, 0.25);
        g.drawEllipse(14 + i * 16, S * 0.3 + (i % 3) * 18, 4, 2);
        g.endFill();
    }
}

function _mcTexGrass(g, S) {
    g.beginFill(0x2d6b3a, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Darker speckles / clumps
    for (let i = 0; i < 20; i++) {
        const x = (i * 37 + 11) % S;
        const y = (i * 53 + 7) % S;
        g.beginFill(0x1a4a22, 0.4 + (i % 3) * 0.1);
        g.drawEllipse(x, y, 5 + (i % 4), 3 + (i % 3));
        g.endFill();
    }
    // Lighter highlights
    for (let i = 0; i < 12; i++) {
        const x = (i * 61 + 20) % S;
        const y = (i * 43 + 15) % S;
        g.beginFill(0x4a9a5a, 0.3);
        g.drawEllipse(x, y, 4, 2);
        g.endFill();
    }
}

function _mcTexSand(g, S) {
    g.beginFill(0xc4a050, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Subtle grain dots
    for (let i = 0; i < 30; i++) {
        const x = (i * 41 + 9) % S;
        const y = (i * 59 + 3) % S;
        const bright = (i % 2) === 0;
        g.beginFill(bright ? 0xd4b870 : 0xa08030, 0.3);
        g.drawCircle(x, y, 1 + (i % 2));
        g.endFill();
    }
    // Wave texture lines
    for (let i = 0; i < 4; i++) {
        g.lineStyle(1, 0x9a7a30, 0.2);
        g.moveTo(0, i * (S / 4) + 8);
        g.bezierCurveTo(S * 0.3, i * (S / 4) + 4, S * 0.7, i * (S / 4) + 12, S, i * (S / 4) + 8);
    }
}

function _mcTexLava(g, S) {
    g.beginFill(0x3d0a00, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Orange vein lines
    g.lineStyle(2, 0xcc4400, 0.8);
    g.moveTo(0, S * 0.6); g.bezierCurveTo(S * 0.2, S * 0.4, S * 0.5, S * 0.7, S, S * 0.5);
    g.moveTo(S * 0.3, 0); g.bezierCurveTo(S * 0.4, S * 0.3, S * 0.6, S * 0.5, S * 0.8, S);
    g.lineStyle(1.5, 0xff6600, 0.6);
    g.moveTo(0, S * 0.3); g.bezierCurveTo(S * 0.4, S * 0.2, S * 0.6, S * 0.4, S, S * 0.8);
    // Bright glow dots at intersections
    g.lineStyle(0);
    const dots = [[S*0.35, S*0.55], [S*0.7, S*0.42], [S*0.2, S*0.38]];
    for (const [x, y] of dots) {
        g.beginFill(0xff9900, 0.7); g.drawCircle(x, y, 5); g.endFill();
        g.beginFill(0xffcc00, 0.4); g.drawCircle(x, y, 10); g.endFill();
    }
}

function _mcTexSnow(g, S) {
    g.beginFill(0xdce8f4, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Crystal patterns (6-pointed snowflake snippets)
    const centers = [[S*0.25,S*0.3],[S*0.7,S*0.65],[S*0.5,S*0.15],[S*0.15,S*0.7]];
    for (const [cx, cy] of centers) {
        g.lineStyle(1, 0x8ab8d8, 0.5);
        for (let a = 0; a < 6; a++) {
            const angle = (a / 6) * Math.PI * 2;
            g.moveTo(cx, cy);
            g.lineTo(cx + Math.cos(angle) * 10, cy + Math.sin(angle) * 10);
        }
    }
    // Shadow drifts
    for (let i = 0; i < 5; i++) {
        g.lineStyle(0);
        g.beginFill(0xb8d0e8, 0.18);
        g.drawEllipse((i * 31 + 12) % S, (i * 43 + 20) % S, 18, 7);
        g.endFill();
    }
}

function _mcTexDark(g, S) {
    g.beginFill(0x0d0d18, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Slight texture: barely visible stone shapes
    for (let i = 0; i < 8; i++) {
        g.lineStyle(1, 0x1a1a2e, 0.6);
        const x = (i * 37) % S, y = (i * 53) % S;
        g.drawRect(x, y, 20 + (i % 3) * 8, 14 + (i % 2) * 6);
    }
}

function _mcTexDirt(g, S) {
    g.beginFill(0x6b4226, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Small rock shapes
    for (let i = 0; i < 12; i++) {
        const x = (i * 43 + 5) % S;
        const y = (i * 57 + 11) % S;
        g.beginFill(0x4a2e16, 0.5);
        g.drawEllipse(x, y, 6 + (i % 4), 4 + (i % 3));
        g.endFill();
    }
    // Lighter soil patches
    for (let i = 0; i < 8; i++) {
        g.beginFill(0x8a5a36, 0.3);
        const x = (i * 67 + 15) % S;
        const y = (i * 37 + 8) % S;
        g.drawEllipse(x, y, 8, 5);
        g.endFill();
    }
}

function _mcTexMarble(g, S) {
    g.beginFill(0xd4cfc8, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Dark vein lines
    g.lineStyle(1.5, 0x6a6060, 0.4);
    g.moveTo(0, S * 0.4); g.bezierCurveTo(S*0.3,S*0.3, S*0.6,S*0.5, S, S*0.35);
    g.moveTo(S*0.2, 0); g.bezierCurveTo(S*0.3,S*0.4, S*0.5,S*0.3, S*0.7, S);
    g.lineStyle(1, 0x8a8080, 0.25);
    g.moveTo(S*0.5, 0); g.bezierCurveTo(S*0.6,S*0.3, S*0.4,S*0.6, S*0.8, S);
    // White highlight streak
    g.lineStyle(2, 0xffffff, 0.2);
    g.moveTo(S*0.1, S*0.8); g.bezierCurveTo(S*0.3,S*0.6, S*0.7,S*0.4, S*0.9, S*0.2);
}

function _mcTexMoss(g, S) {
    g.beginFill(0x3a5a3a, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Pebble shapes
    for (let i = 0; i < 15; i++) {
        const x = (i * 41 + 8) % S;
        const y = (i * 53 + 14) % S;
        g.beginFill(0x2a3a2a, 0.5);
        g.drawEllipse(x, y, 8 + (i % 4), 6 + (i % 3));
        g.endFill();
    }
    // Moss highlights
    for (let i = 0; i < 10; i++) {
        g.beginFill(0x5a8a4a, 0.35);
        const x = (i * 59 + 4) % S;
        const y = (i * 31 + 20) % S;
        g.drawEllipse(x, y, 5, 3);
        g.endFill();
    }
}

function _mcTexIce(g, S) {
    g.beginFill(0xc8e8f0, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Crack lines
    g.lineStyle(1, 0x7abcd4, 0.5);
    g.moveTo(S*0.3, 0); g.lineTo(S*0.45, S*0.4); g.lineTo(S*0.6, S*0.6); g.lineTo(S*0.8, S);
    g.moveTo(0, S*0.5); g.lineTo(S*0.35, S*0.55); g.lineTo(S*0.5, S*0.4); g.lineTo(S, S*0.3);
    g.lineStyle(1, 0x4a9abf, 0.3);
    g.moveTo(S*0.1, S*0.2); g.lineTo(S*0.4, S*0.3); g.lineTo(S*0.55, S*0.7);
    // Glossy highlights
    for (let i = 0; i < 4; i++) {
        g.beginFill(0xffffff, 0.2);
        g.drawEllipse((i * 37 + 10) % S, (i * 29 + 8) % S, 10, 4);
        g.endFill();
    }
}

// ─── Canvas resize ─────────────────────────────────────────────────────────

function _mcResizeCanvas() {
    if (!_mc.app) return;
    try { _mc.app.resize(); } catch (_) {}
}

// ─── Viewport ──────────────────────────────────────────────────────────────

function _mcApplyViewport() {
    if (!_mc.stage.world) return;
    _mc.stage.world.position.set(_mc.pan.x, _mc.pan.y);
    _mc.stage.world.scale.set(_mc.zoom, _mc.zoom);
}

function _mcZoomAt(sx, sy, delta) {
    const factor  = delta > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(10, Math.max(0.08, _mc.zoom * factor));
    const wx = (sx - _mc.pan.x) / _mc.zoom;
    const wy = (sy - _mc.pan.y) / _mc.zoom;
    _mc.pan.x = sx - wx * newZoom;
    _mc.pan.y = sy - wy * newZoom;
    _mc.zoom  = newZoom;
    _mcApplyViewport();
    _mcSyncStatusBar();
}

function _mcScreenToWorld(sx, sy) {
    return {
        x: (sx - _mc.pan.x) / _mc.zoom,
        y: (sy - _mc.pan.y) / _mc.zoom,
    };
}

function _mcSnapToGrid(x, y) {
    if (!_mc.scene.grid.enabled) return { x, y };
    const s = _mc.scene.grid.size;
    return { x: Math.round(x / s) * s, y: Math.round(y / s) * s };
}

// ─── Render: escena completa ────────────────────────────────────────────────

function _mcRenderAll() {
    _mcRenderBackground();
    _mcRenderGrid();
    _mcRenderDrawings();
    _mcRenderTiles();
    _mcRenderWalls();
    _mcRenderDoors();
    _mcRenderNotes();
    _mcRenderFog();
    _mcRenderUI();
}

function _mcRenderBackground() {
    const c = _mc.stage.background;
    c.removeChildren().forEach(ch => ch.destroy({ children: true }));

    const { type, color, url, width, height } = _mc.scene.background;

    if (type === 'color') {
        const col = parseInt((color || '#1a1a2e').replace('#', ''), 16);
        const g = new PIXI.Graphics();
        g.beginFill(col, 1);
        g.drawRect(0, 0, width, height);
        g.endFill();
        c.addChild(g);
    } else if (type === 'image' && url) {
        const sprite = PIXI.Sprite.from(url);
        sprite.width  = width;
        sprite.height = height;
        c.addChild(sprite);
    } else {
        const g = new PIXI.Graphics();
        g.beginFill(0x1a1a2e, 1);
        g.drawRect(0, 0, width, height);
        g.endFill();
        c.addChild(g);
    }

    const border = new PIXI.Graphics();
    border.lineStyle(1.5, 0x3a3a5c, 1);
    border.drawRect(0, 0, width, height);
    c.addChild(border);
}

function _mcRenderGrid() {
    const g = _mc.stage.grid;
    g.clear();
    const { enabled, size, color, alpha } = _mc.scene.grid;
    if (!enabled) return;

    const { width, height } = _mc.scene.background;
    const col = parseInt((color || '#ffffff').replace('#', ''), 16);
    g.lineStyle(1, col, alpha);

    for (let x = 0; x <= width; x += size) { g.moveTo(x, 0); g.lineTo(x, height); }
    for (let y = 0; y <= height; y += size) { g.moveTo(0, y); g.lineTo(width, y); }
}

function _mcRenderDrawings() {
    const c = _mc.stage.drawings;
    c.removeChildren().forEach(ch => ch.destroy({ children: true }));

    if (!_mc.scene.drawings) return;

    for (const d of _mc.scene.drawings) {
        const sel = _mc.selection?.type === 'drawing' && _mc.selection.id === d.id;
        const g   = new PIXI.Graphics();
        const fillColor  = typeof d.fillColor === 'number' ? d.fillColor : 0x3a5a8a;
        const fillAlpha  = d.fillAlpha !== undefined ? d.fillAlpha : 0.55;
        const strokeColor = typeof d.strokeColor === 'number' ? d.strokeColor : 0x7ab3e0;
        const strokeWidth = d.strokeWidth !== undefined ? d.strokeWidth : 2;

        if (strokeWidth > 0) {
            g.lineStyle(strokeWidth, sel ? 0xffd700 : strokeColor, 1);
        }
        g.beginFill(fillColor, fillAlpha);

        if (d.type === 'rect') {
            g.drawRect(d.x, d.y, d.width, d.height);
        } else if (d.type === 'ellipse') {
            g.drawEllipse(d.x + d.width / 2, d.y + d.height / 2, d.width / 2, d.height / 2);
        }

        g.endFill();
        g.eventMode = 'none';
        c.addChild(g);
    }
}

function _mcRenderTiles() {
    const c = _mc.stage.tiles;
    c.removeChildren().forEach(ch => ch.destroy({ children: true }));

    for (const tile of _mc.scene.tiles) {
        const texture = _mcGetTexture(tile.url);
        const sprite  = new PIXI.Sprite(texture);
        // Use center anchor so rotation works correctly
        sprite.anchor.set(0.5, 0.5);
        sprite.x        = tile.x + tile.width / 2;
        sprite.y        = tile.y + tile.height / 2;
        sprite.width    = tile.width;
        sprite.height   = tile.height;
        sprite.rotation = tile.rotation || 0;
        sprite.alpha    = tile.alpha !== undefined ? tile.alpha : 1;
        sprite.eventMode = 'none';
        c.addChild(sprite);
    }
}

function _mcRenderWalls() {
    const g = _mc.stage.walls;
    g.clear();

    for (const wall of _mc.scene.walls) {
        const sel   = _mc.selection?.type === 'wall' && _mc.selection.id === wall.id;
        const col   = sel ? 0xffd700 : (wall.type === 'window' ? 0x3b82f6 : 0xef4444);
        const thick = wall.type === 'window' ? 2 : 3;
        g.lineStyle(thick, col, 1);
        g.moveTo(wall.x1, wall.y1);
        g.lineTo(wall.x2, wall.y2);
        g.lineStyle(0);
        g.beginFill(col, 1);
        g.drawCircle(wall.x1, wall.y1, 5);
        g.drawCircle(wall.x2, wall.y2, 5);
        g.endFill();
    }

    // Wall chain preview (chaining mode)
    if (_mc.wallChain && _mc.wallChain.previewEnd) {
        const { lastPoint, previewEnd } = _mc.wallChain;
        g.lineStyle(0);
        g.beginFill(0xffd700, 0.9);
        g.drawCircle(lastPoint.x, lastPoint.y, 6);
        g.endFill();
        // Dashed preview line
        _mcDrawDashedLine(g, lastPoint.x, lastPoint.y, previewEnd.x, previewEnd.y, 10, 6, 0xffd700, 0.7, 2);
    }

    // Legacy single-drag wall in progress
    if (_mc.wallDrawing) {
        g.lineStyle(2, 0xef4444, 0.55);
        g.moveTo(_mc.wallDrawing.x1, _mc.wallDrawing.y1);
        g.lineTo(_mc.wallDrawing.x2, _mc.wallDrawing.y2);
    }
}

function _mcDrawDashedLine(g, x1, y1, x2, y2, dashLen, gapLen, color, alpha, width) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    const nx = dx / len, ny = dy / len;
    let pos = 0, drawing = true;
    while (pos < len) {
        const segLen = Math.min(drawing ? dashLen : gapLen, len - pos);
        if (drawing) {
            g.lineStyle(width || 2, color || 0xffd700, alpha !== undefined ? alpha : 1);
            g.moveTo(x1 + nx * pos, y1 + ny * pos);
            g.lineTo(x1 + nx * (pos + segLen), y1 + ny * (pos + segLen));
        }
        pos += segLen;
        drawing = !drawing;
    }
    g.lineStyle(0);
}

function _mcRenderDoors() {
    const c = _mc.stage.doors;
    c.removeChildren().forEach(ch => ch.destroy({ children: true }));

    for (const door of _mc.scene.doors) {
        const sel = _mc.selection?.type === 'door' && _mc.selection.id === door.id;
        const col = sel ? 0xffd700 : (door.open ? 0x22c55e : 0xf97316);
        const g   = new PIXI.Graphics();
        g.lineStyle(3, col, 1);
        g.moveTo(-16, 0);
        g.lineTo(16, 0);
        g.lineStyle(0);
        g.beginFill(col);
        g.drawCircle(0, 0, 7);
        g.endFill();
        g.x        = door.x;
        g.y        = door.y;
        g.rotation = door.rotation || 0;
        g.eventMode = 'none';
        c.addChild(g);
    }
}

function _mcRenderNotes() {
    const c = _mc.stage.notes;
    c.removeChildren().forEach(ch => ch.destroy({ children: true }));

    for (const note of _mc.scene.notes) {
        const sel = _mc.selection?.type === 'note' && _mc.selection.id === note.id;
        const col = sel ? 0xffd700 : 0xfbbf24;
        const g   = new PIXI.Graphics();
        g.lineStyle(2, col, 1);
        g.beginFill(0x1e1e2e, 0.9);
        g.drawRoundedRect(-15, -15, 30, 30, 5);
        g.endFill();
        g.lineStyle(0);
        g.beginFill(col);
        g.drawCircle(0, -2, 5);
        g.drawPolygon([-3, 3, 3, 3, 0, 9]);
        g.endFill();

        if (note.text) {
            const lbl = new PIXI.Text(note.text.slice(0, 18), new PIXI.TextStyle({
                fontFamily: 'sans-serif', fontSize: 10, fill: '#ffffff',
                wordWrap: true, wordWrapWidth: 110,
            }));
            lbl.anchor.set(0.5, 0);
            lbl.y = 18;
            g.addChild(lbl);
        }

        g.x = note.x;
        g.y = note.y;
        g.eventMode = 'none';
        c.addChild(g);
    }
}

function _mcRenderFog() {
    const g = _mc.stage.fog;
    g.clear();
    if (!_mc.scene.fog.enabled) return;

    const { width, height } = _mc.scene.background;
    g.beginFill(0x000000, 0.78);
    g.drawRect(0, 0, width, height);

    for (const region of _mc.scene.fog.regions) {
        if (!region.revealed) continue;
        if (region.type === 'circle') {
            const pts = [];
            const segs = 32;
            for (let i = 0; i < segs; i++) {
                const a = (i / segs) * Math.PI * 2;
                pts.push(region.cx + Math.cos(a) * region.r, region.cy + Math.sin(a) * region.r);
            }
            g.beginHole();
            g.drawPolygon(pts);
            g.endHole();
        }
    }

    g.endFill();
}

// ─── UI handles (selection, resize, rotation) ──────────────────────────────

function _mcRenderUI() {
    const h = _mc.stage.uiHandles;
    h.clear();

    if (!_mc.selection) return;

    const bounds = _mcGetSelectedBounds();
    if (!bounds) return;

    const { x, y, w, height } = bounds;

    // Gold selection outline
    h.lineStyle(1.5, 0xffd700, 0.85);
    h.beginFill(0, 0);
    h.drawRect(x, y, w, height);
    h.endFill();

    // 8 resize handles (white squares)
    const handles = _mcGetBoundsHandles({ x, y, w, height });
    h.lineStyle(1, 0x000000, 0.5);
    h.beginFill(0xffffff, 1);
    for (const handle of handles) {
        if (handle.id === 'rot') continue;
        h.drawRect(handle.wx - 5, handle.wy - 5, 10, 10);
    }
    h.endFill();

    // Rotation handle (circle above top-center)
    const rotHandle = handles.find(hh => hh.id === 'rot');
    if (rotHandle) {
        // Dashed line from top-center to rot handle
        _mcDrawDashedLine(h, x + w / 2, y, rotHandle.wx, rotHandle.wy, 6, 4, 0xffd700, 0.5, 1);
        h.lineStyle(1.5, 0xffd700, 0.9);
        h.beginFill(0x1e1e2e, 1);
        h.drawCircle(rotHandle.wx, rotHandle.wy, 7);
        h.endFill();
        h.lineStyle(1, 0xffd700, 0.8);
        h.beginFill(0xffd700, 1);
        h.drawCircle(rotHandle.wx, rotHandle.wy, 3);
        h.endFill();
    }
}

function _mcGetBoundsHandles(bounds) {
    const { x, y, w, height } = bounds;
    const cx = x + w / 2, cy = y + height / 2;
    return [
        { id: 'nw', wx: x,       wy: y,          cursor: 'nw-resize' },
        { id: 'n',  wx: cx,      wy: y,          cursor: 'n-resize'  },
        { id: 'ne', wx: x + w,   wy: y,          cursor: 'ne-resize' },
        { id: 'e',  wx: x + w,   wy: cy,         cursor: 'e-resize'  },
        { id: 'se', wx: x + w,   wy: y + height, cursor: 'se-resize' },
        { id: 's',  wx: cx,      wy: y + height, cursor: 's-resize'  },
        { id: 'sw', wx: x,       wy: y + height, cursor: 'sw-resize' },
        { id: 'w',  wx: x,       wy: cy,         cursor: 'w-resize'  },
        { id: 'rot',wx: cx,      wy: y - 35,     cursor: 'crosshair' },
    ];
}

function _mcGetHandleAt(wx, wy) {
    const bounds = _mcGetSelectedBounds();
    if (!bounds) return null;
    const handles = _mcGetBoundsHandles(bounds);
    for (const handle of handles) {
        if (Math.hypot(wx - handle.wx, wy - handle.wy) <= 10) return handle;
    }
    return null;
}

function _mcGetSelectedBounds() {
    if (!_mc.selection) return null;
    const { type, id } = _mc.selection;

    if (type === 'tile') {
        const tile = _mc.scene.tiles.find(t => t.id === id);
        if (!tile) return null;
        return { x: tile.x, y: tile.y, w: tile.width, height: tile.height };
    }

    if (type === 'drawing') {
        const d = _mc.scene.drawings.find(dr => dr.id === id);
        if (!d) return null;
        return { x: d.x, y: d.y, w: d.width, height: d.height };
    }

    return null;
}

function _mcUpdateCursor(wx, wy) {
    const canvas = _mc.app?.view;
    if (!canvas) return;

    if (_mc.selection && _mc.tool === 'select') {
        const handle = _mcGetHandleAt(wx, wy);
        if (handle) {
            canvas.style.cursor = handle.cursor;
            return;
        }
    }

    const hit = _mcHitTest(wx, wy);
    if (hit) {
        canvas.style.cursor = 'grab';
    } else {
        canvas.style.cursor = 'default';
    }
}

// ─── Texture cache ─────────────────────────────────────────────────────────

function _mcGetTexture(url) {
    if (!url) return PIXI.Texture.WHITE;

    // Check built-in texture keys first
    if (_mc.textureCache.has(url)) return _mc.textureCache.get(url);

    let texture;
    if (url.startsWith('color:')) {
        const col = parseInt(url.replace('color:', ''), 16);
        const g   = new PIXI.Graphics();
        g.beginFill(col, 1);
        g.drawRect(0, 0, 64, 64);
        g.endFill();
        texture = _mc.app.renderer.generateTexture(g);
        g.destroy();
    } else if (url) {
        texture = PIXI.Texture.from(url);
    } else {
        texture = PIXI.Texture.WHITE;
    }

    _mc.textureCache.set(url, texture);
    return texture;
}

function _mcClearTextureCache() {
    for (const [key, tex] of _mc.textureCache) {
        // Don't destroy built-in tile textures — keep them alive for reuse
        if (key.startsWith('tile:')) continue;
        if (tex && !tex.destroyed && tex !== PIXI.Texture.WHITE) tex.destroy();
    }
    // Only remove non-tile entries
    for (const key of [..._mc.textureCache.keys()]) {
        if (!key.startsWith('tile:')) _mc.textureCache.delete(key);
    }
}

// ─── Hit testing ──────────────────────────────────────────────────────────

function _mcHitTest(wx, wy) {
    // Tiles — de arriba a abajo (el último añadido está encima)
    for (let i = _mc.scene.tiles.length - 1; i >= 0; i--) {
        const t = _mc.scene.tiles[i];
        // For rotated tiles, use an axis-aligned bounding box check (close enough for selection)
        if (wx >= t.x && wx <= t.x + t.width && wy >= t.y && wy <= t.y + t.height) {
            return { type: 'tile', id: t.id };
        }
    }
    // Drawings
    if (_mc.scene.drawings) {
        for (let i = _mc.scene.drawings.length - 1; i >= 0; i--) {
            const d = _mc.scene.drawings[i];
            if (_mcPointInDrawing(wx, wy, d)) return { type: 'drawing', id: d.id };
        }
    }
    // Puertas
    for (const d of _mc.scene.doors) {
        if (Math.hypot(wx - d.x, wy - d.y) < 16) return { type: 'door', id: d.id };
    }
    // Notas
    for (const n of _mc.scene.notes) {
        if (Math.abs(wx - n.x) < 16 && Math.abs(wy - n.y) < 16) return { type: 'note', id: n.id };
    }
    // Muros
    for (const w of _mc.scene.walls) {
        if (_mcDistToSegment(wx, wy, w.x1, w.y1, w.x2, w.y2) < 10) return { type: 'wall', id: w.id };
    }
    return null;
}

function _mcPointInDrawing(wx, wy, d) {
    if (d.type === 'rect') {
        return wx >= d.x && wx <= d.x + d.width && wy >= d.y && wy <= d.y + d.height;
    }
    if (d.type === 'ellipse') {
        const cx = d.x + d.width / 2, cy = d.y + d.height / 2;
        const rx = d.width / 2, ry = d.height / 2;
        if (rx <= 0 || ry <= 0) return false;
        return ((wx - cx) * (wx - cx)) / (rx * rx) + ((wy - cy) * (wy - cy)) / (ry * ry) <= 1;
    }
    return false;
}

function _mcDistToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
}

function _mcGetObject(type, id) {
    if (type === 'tile')    return _mc.scene.tiles.find(t => t.id === id);
    if (type === 'wall')    return _mc.scene.walls.find(w => w.id === id);
    if (type === 'door')    return _mc.scene.doors.find(d => d.id === id);
    if (type === 'note')    return _mc.scene.notes.find(n => n.id === id);
    if (type === 'drawing') return (_mc.scene.drawings || []).find(dr => dr.id === id);
    return null;
}

// ─── Selection ─────────────────────────────────────────────────────────────

function _mcSelectObject(type, id) {
    _mc.selection = { type, id };
    _mcRenderWalls();
    _mcRenderDoors();
    _mcRenderNotes();
    _mcRenderDrawings();
    _mcRenderUI();
    if (_mc.panelTab !== 'props') mcPanelTab('props');
    else _mcUpdatePropertiesPanel();
}

function _mcDeselect() {
    if (!_mc.selection) return;
    _mc.selection = null;
    _mcRenderWalls();
    _mcRenderDoors();
    _mcRenderNotes();
    _mcRenderDrawings();
    _mcRenderUI();
    _mcUpdatePropertiesPanel();
}

// ─── Context menu ─────────────────────────────────────────────────────────

function _mcShowContextMenu(cx, cy) {
    const menu = document.getElementById('mcContextMenu');
    if (!menu) return;

    // Build items based on selection
    const hasSelection = !!_mc.selection;
    const isTileOrDrawing = hasSelection &&
        (_mc.selection.type === 'tile' || _mc.selection.type === 'drawing');

    let items = '';
    if (hasSelection) {
        items += `<div class="mc-ctx-item" onclick="_mcCtxAction('delete')">Eliminar</div>`;
        if (isTileOrDrawing) {
            items += `<div class="mc-ctx-item" onclick="_mcCtxAction('duplicate')">Duplicar</div>`;
            items += `<div class="mc-ctx-sep"></div>`;
            items += `<div class="mc-ctx-item" onclick="_mcCtxAction('front')">Traer al frente</div>`;
            items += `<div class="mc-ctx-item" onclick="_mcCtxAction('back')">Enviar atrás</div>`;
        }
    } else {
        items = `<div class="mc-ctx-item" style="opacity:0.5;cursor:default">Sin selección</div>`;
    }

    menu.innerHTML = items;
    menu.style.left = cx + 'px';
    menu.style.top  = cy + 'px';
    menu.classList.add('visible');
}

function _mcHideContextMenu() {
    const menu = document.getElementById('mcContextMenu');
    if (menu) menu.classList.remove('visible');
}

function _mcCtxAction(action) {
    _mcHideContextMenu();
    if (!_mc.selection) return;
    const { type, id } = _mc.selection;

    if (action === 'delete') {
        mcDeleteSelected();
    } else if (action === 'duplicate') {
        mcDuplicate();
    } else if (action === 'front') {
        mcBringToFront();
    } else if (action === 'back') {
        mcSendToBack();
    }
}

function mcDuplicate() {
    if (!_mc.selection) return;
    const { type, id } = _mc.selection;
    const obj = _mcGetObject(type, id);
    if (!obj) return;

    _mcPushHistory();
    const copy = JSON.parse(JSON.stringify(obj));
    copy.id = _mcUUID();

    const offset = _mc.scene.grid.size || 70;
    if (type === 'tile') {
        copy.x += offset;
        copy.y += offset;
        _mc.scene.tiles.push(copy);
        _mcRenderTiles();
    } else if (type === 'drawing') {
        copy.x += offset;
        copy.y += offset;
        if (!_mc.scene.drawings) _mc.scene.drawings = [];
        _mc.scene.drawings.push(copy);
        _mcRenderDrawings();
    }

    _mcSelectObject(type, copy.id);
}

function mcBringToFront() {
    if (!_mc.selection) return;
    const { type, id } = _mc.selection;
    _mcPushHistory();

    if (type === 'tile') {
        const idx = _mc.scene.tiles.findIndex(t => t.id === id);
        if (idx >= 0) {
            const [tile] = _mc.scene.tiles.splice(idx, 1);
            _mc.scene.tiles.push(tile);
            _mcRenderTiles();
        }
    } else if (type === 'drawing') {
        const arr = _mc.scene.drawings || [];
        const idx = arr.findIndex(d => d.id === id);
        if (idx >= 0) {
            const [drawing] = arr.splice(idx, 1);
            arr.push(drawing);
            _mcRenderDrawings();
        }
    }
}

function mcSendToBack() {
    if (!_mc.selection) return;
    const { type, id } = _mc.selection;
    _mcPushHistory();

    if (type === 'tile') {
        const idx = _mc.scene.tiles.findIndex(t => t.id === id);
        if (idx >= 0) {
            const [tile] = _mc.scene.tiles.splice(idx, 1);
            _mc.scene.tiles.unshift(tile);
            _mcRenderTiles();
        }
    } else if (type === 'drawing') {
        const arr = _mc.scene.drawings || [];
        const idx = arr.findIndex(d => d.id === id);
        if (idx >= 0) {
            const [drawing] = arr.splice(idx, 1);
            arr.unshift(drawing);
            _mcRenderDrawings();
        }
    }
}

// ─── Historial (undo / redo) ────────────────────────────────────────────────

function _mcPushHistory() {
    _mc.history = _mc.history.slice(0, _mc.historyIndex + 1);
    _mc.history.push(JSON.stringify(_mc.scene));
    if (_mc.history.length > 60) _mc.history.shift();
    _mc.historyIndex = _mc.history.length - 1;
    _mc.modified = true;
    _mcUpdateModifiedDot();
    _mcScheduleAutoSave();
}

function mcUndo() {
    if (_mc.historyIndex <= 0) return;
    _mc.historyIndex--;
    _mc.scene     = JSON.parse(_mc.history[_mc.historyIndex]);
    _mc.selection = null;
    _mc.wallChain = null;
    _mcRenderAll();
    _mcUpdateUI();
}

function mcRedo() {
    if (_mc.historyIndex >= _mc.history.length - 1) return;
    _mc.historyIndex++;
    _mc.scene     = JSON.parse(_mc.history[_mc.historyIndex]);
    _mc.selection = null;
    _mc.wallChain = null;
    _mcRenderAll();
    _mcUpdateUI();
}

function _mcUpdateModifiedDot() {
    const el = document.getElementById('mcModifiedDot');
    if (el) el.style.display = _mc.modified ? 'inline-block' : 'none';
}

// ─── Herramienta activa ─────────────────────────────────────────────────────

function mcSetTool(tool) {
    // Finish wall chain when switching away
    if (_mc.tool === 'wall' && tool !== 'wall' && _mc.wallChain) {
        _mcWallFinish();
    }
    _mc.tool        = tool;
    _mc.wallDrawing = null;
    if (tool !== 'tile') _mc.tileToPlace = null;
    if (tool !== 'draw') _mc.drawStart = null;
    _mcDeselect();
    _mcUpdateToolbar();
    _mcRenderWalls();

    // Show/hide draw subbar
    _mcUpdateDrawSubbar();
    _mcUpdateFogModeIndicator();
}

function _mcUpdateToolbar() {
    document.querySelectorAll('.mc-tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === _mc.tool);
    });
}

function _mcUpdateDrawSubbar() {
    const subbar = document.getElementById('mcDrawSubbar');
    if (!subbar) return;
    subbar.classList.toggle('visible', _mc.tool === 'draw');
}

function _mcUpdateFogModeIndicator() {
    const el = document.getElementById('mcFogModeIndicator');
    if (!el) return;
    if (_mc.tool === 'fog') {
        el.style.display = 'block';
        el.textContent = _mc.fogErasing ? 'Modo: Añadir niebla (Clic der = revelar)' : 'Modo: Revelar (Clic der = añadir niebla)';
    } else {
        el.style.display = 'none';
    }
}

// ─── Delete / duplicar ─────────────────────────────────────────────────────

function mcDeleteSelected() {
    if (!_mc.selection) return;
    const { type, id } = _mc.selection;
    _mcPushHistory();

    if (type === 'tile')    _mc.scene.tiles    = _mc.scene.tiles.filter(t => t.id !== id);
    if (type === 'wall')    _mc.scene.walls    = _mc.scene.walls.filter(w => w.id !== id);
    if (type === 'door')    _mc.scene.doors    = _mc.scene.doors.filter(d => d.id !== id);
    if (type === 'note')    _mc.scene.notes    = _mc.scene.notes.filter(n => n.id !== id);
    if (type === 'drawing') _mc.scene.drawings = (_mc.scene.drawings || []).filter(dr => dr.id !== id);

    _mc.selection = null;
    _mcRenderAll();
    _mcUpdatePropertiesPanel();
}

// ─── Guardado ──────────────────────────────────────────────────────────────

async function mcSave() {
    const btn = document.getElementById('mcSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

    try {
        const name         = _mc.scene.name || 'Mapa sin nombre';
        const thumbnailUrl = await _mcExportThumbnail();

        if (_mc.mapId) {
            const res = await fetch(`${API_BASE}/api/combat-maps/${_mc.mapId}`, {
                method:  'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    name,
                    sceneData: _mc.scene,
                    fileData:  thumbnailUrl,
                    filename:  `editor-${Date.now()}.png`,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al guardar');
        } else {
            const res = await fetch(`${API_BASE}/api/combat-maps`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    name,
                    filename:   `editor-${Date.now()}.png`,
                    fileData:   thumbnailUrl,
                    sceneData:  _mc.scene,
                    sourceType: 'editor',
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al guardar');
            _mc.mapId = data._id;
        }

        _mc.modified = false;
        _mcUpdateModifiedDot();
        invalidateCombatMapsCache();
        showNotification('Mapa guardado', 2000);
    } catch (err) {
        showNotification('Error: ' + err.message, 3000);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
    }
}

function _mcScheduleAutoSave() {
    clearTimeout(_mc.autoSaveTimer);
    if (!_mc.mapId) return;
    _mc.autoSaveTimer = setTimeout(async () => {
        if (_mc.modified && _mc.mapId) {
            try {
                const thumbnailUrl = await _mcExportThumbnail();
                await fetch(`${API_BASE}/api/combat-maps/${_mc.mapId}`, {
                    method:  'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({
                        name:      _mc.scene.name,
                        sceneData: _mc.scene,
                        fileData:  thumbnailUrl,
                        filename:  `editor-${Date.now()}.png`,
                    }),
                });
                _mc.modified = false;
                _mcUpdateModifiedDot();
                invalidateCombatMapsCache();
            } catch (_) { /* silencioso en auto-save */ }
        }
    }, 3000);
}

// ─── Carga de mapa existente ───────────────────────────────────────────────

async function _mcLoadMap(id) {
    try {
        const res = await fetch(`${API_BASE}/api/combat-maps/${id}`);
        if (!res.ok) throw new Error('No se pudo cargar el mapa');
        const data = await res.json();

        if (!data.sceneData) {
            showNotification('Este mapa no tiene datos de escena editables', 3000);
            return;
        }

        _mc.scene        = data.sceneData;
        // Ensure drawings array exists for old scenes
        if (!_mc.scene.drawings) _mc.scene.drawings = [];

        _mc.mapId        = data._id;
        _mc.history      = [JSON.stringify(_mc.scene)];
        _mc.historyIndex = 0;
        _mc.modified     = false;

        _mcClearTextureCache();
        _mcApplyViewport();
        _mcRenderAll();
        _mcUpdateUI();
        _mcSyncTopbar();
    } catch (err) {
        showNotification('Error: ' + err.message, 3000);
    }
}

// ─── Descarga ──────────────────────────────────────────────────────────────

async function mcDownload() {
    const name = (_mc.scene.name || 'mapa').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');

    try {
        const dataUrl = await _mcExportFullRender();
        const a = document.createElement('a');
        a.download = `${name}.png`;
        a.href     = dataUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (err) {
        showNotification('No se pudo exportar la imagen: ' + err.message, 3000);
    }

    setTimeout(() => {
        const blob    = new Blob([JSON.stringify(_mc.scene, null, 2)], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(blob);
        const b       = document.createElement('a');
        b.download    = `${name}.scene.json`;
        b.href        = jsonUrl;
        document.body.appendChild(b);
        b.click();
        document.body.removeChild(b);
        setTimeout(() => URL.revokeObjectURL(jsonUrl), 5000);
    }, 300);
}

async function _mcExportThumbnail() {
    return _mcExportCanvas(400, null);
}

async function _mcExportFullRender() {
    const { width, height } = _mc.scene.background;
    return _mcExportCanvas(width, height);
}

function _mcExportCanvas(targetW, targetH) {
    const { width, height } = _mc.scene.background;

    const sv = { x: _mc.stage.world.x, y: _mc.stage.world.y,
                  sx: _mc.stage.world.scale.x, sy: _mc.stage.world.scale.y };

    _mc.stage.world.position.set(0, 0);
    _mc.stage.world.scale.set(1, 1);

    const rt = PIXI.RenderTexture.create({ width, height });
    _mc.app.renderer.render(_mc.stage.world, { renderTexture: rt });

    const srcCanvas = _mc.app.renderer.extract.canvas(rt);
    rt.destroy();

    _mc.stage.world.position.set(sv.x, sv.y);
    _mc.stage.world.scale.set(sv.sx, sv.sy);

    let outCanvas = srcCanvas;
    if (targetW && targetH && (targetW !== width || targetH !== height)) {
        outCanvas = document.createElement('canvas');
        outCanvas.width  = targetW;
        outCanvas.height = targetH;
        outCanvas.getContext('2d').drawImage(srcCanvas, 0, 0, targetW, targetH);
    } else if (targetW && !targetH) {
        const ratio  = targetW / width;
        outCanvas    = document.createElement('canvas');
        outCanvas.width  = targetW;
        outCanvas.height = Math.round(height * ratio);
        outCanvas.getContext('2d').drawImage(srcCanvas, 0, 0, outCanvas.width, outCanvas.height);
    }

    return outCanvas.toDataURL('image/png');
}

// ─── Volver ────────────────────────────────────────────────────────────────

function mcGoBack() {
    if (_mc.modified) {
        if (!confirm('Hay cambios sin guardar. ¿Salir de todos modos?')) return;
    }
    clearTimeout(_mc.autoSaveTimer);
    _mc.modified = false;
    _mc.wallChain = null;
    if (_mc.app) _mc.app.ticker.stop();
    setView('mapCreatorHub');
}

// ─── UI sync helpers ────────────────────────────────────────────────────────

function _mcSyncTopbar() {
    const el = document.getElementById('mcMapNameDisplay');
    if (el) el.textContent = _mc.scene?.name || 'Nuevo mapa';
    _mcUpdateModifiedDot();
}

function _mcSyncStatusBar() {
    const z   = document.getElementById('mcStatusZoom');
    const pos = document.getElementById('mcStatusPos');
    if (z)   z.textContent   = Math.round(_mc.zoom * 100) + '%';
    if (pos) pos.textContent = `${Math.round(_mc.mouseWorld.x)}, ${Math.round(_mc.mouseWorld.y)}`;
}

function _mcUpdateUI() {
    _mcSyncTopbar();
    _mcSyncStatusBar();
    _mcUpdateToolbar();
    if (_mc.panelTab === 'scene')  _mcUpdateScenePanel();
    else if (_mc.panelTab === 'props') _mcUpdatePropertiesPanel();
    else if (_mc.panelTab === 'tiles') _mcUpdateTilesPanel();
    else if (_mc.panelTab === 'layers') _mcUpdateLayersPanel();
}

// ─── Eventos de ratón / teclado ────────────────────────────────────────────

function _mcOnWheel(e) {
    e.preventDefault();
    _mcZoomAt(e.offsetX, e.offsetY, e.deltaY);
}

function _mcOnMouseDown(e) {
    _mcHideContextMenu();

    const rect = _mc.app.view.getBoundingClientRect();
    const sx   = e.clientX - rect.left;
    const sy   = e.clientY - rect.top;

    if (e.button === 1 || (e.button === 0 && _mc.spaceDown)) {
        _mc.isPanning    = true;
        _mc.panStart     = { x: e.clientX, y: e.clientY };
        _mc.panStartPos  = { x: _mc.pan.x, y: _mc.pan.y };
        return;
    }

    const wp = _mcScreenToWorld(sx, sy);

    if (e.button === 2) {
        // Right-click
        if (_mc.tool === 'wall') {
            _mcWallFinish();
        } else if (_mc.tool === 'fog') {
            // Right-click fog = erase/restore fog
            _mc.fogErasing = true;
            _mc.fogPainting = true;
            _mcFogAddAt(wp.x, wp.y);
        } else if (_mc.tool === 'select') {
            const hit = _mcHitTest(wp.x, wp.y);
            if (hit) _mcSelectObject(hit.type, hit.id);
            _mcShowContextMenu(e.clientX, e.clientY);
        } else if (_mc.tool === 'draw') {
            _mc.drawStart = null;
            _mc.stage.uiPreview.clear();
        }
        return;
    }

    if (e.button !== 0) return;

    if (_mc.tool === 'fog') {
        _mc.fogErasing = false;
    }

    _mcToolDown(wp.x, wp.y, e);
}

function _mcOnMouseMove(e) {
    const rect = _mc.app.view.getBoundingClientRect();
    const sx   = e.clientX - rect.left;
    const sy   = e.clientY - rect.top;
    const wp   = _mcScreenToWorld(sx, sy);

    _mc.mouseWorld = wp;
    _mcSyncStatusBar();

    if (_mc.isPanning) {
        _mc.pan.x = _mc.panStartPos.x + (e.clientX - _mc.panStart.x);
        _mc.pan.y = _mc.panStartPos.y + (e.clientY - _mc.panStart.y);
        _mcApplyViewport();
        return;
    }

    _mcToolMove(wp.x, wp.y, e);

    // Update cursor
    if (!_mc.spaceDown) _mcUpdateCursor(wp.x, wp.y);
}

function _mcOnMouseUp(e) {
    if (_mc.isPanning) { _mc.isPanning = false; return; }

    const rect = _mc.app.view.getBoundingClientRect();
    const wp   = _mcScreenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (e.button === 2) {
        if (_mc.tool === 'fog' && _mc.fogPainting) {
            _mc.fogPainting = false;
            _mc.fogErasing  = false;
            _mcPushHistory();
        }
        return;
    }

    if (e.button !== 0) return;
    _mcToolUp(wp.x, wp.y);
}

function _mcOnMouseLeave() {
    if (_mc.isPanning) _mc.isPanning = false;
    if (_mc.fogPainting) { _mc.fogPainting = false; _mc.fogErasing = false; _mcPushHistory(); }
}

function _mcOnDblClick(e) {
    if (_mc.tool === 'wall') {
        _mcWallFinish();
    }
}

function _mcOnContextMenu(e) {
    e.preventDefault();
}

function _mcOnDocClick(e) {
    // Hide context menu when clicking outside it
    const menu = document.getElementById('mcContextMenu');
    if (menu && !menu.contains(e.target)) {
        _mcHideContextMenu();
    }
}

function _mcOnKeyDown(e) {
    if (state.currentView !== 'mapCreator') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    _mc.shiftDown = e.shiftKey;

    if (e.code === 'Space') { _mc.spaceDown = true; e.preventDefault(); return; }
    if (e.key === 'Escape') {
        if (_mc.wallChain) { _mcWallFinish(); }
        else { _mcDeselect(); }
        _mcHideContextMenu();
        return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { mcDeleteSelected(); e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { mcUndo(); e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        mcRedo(); e.preventDefault(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { mcSave(); e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        mcDuplicate(); e.preventDefault(); return;
    }

    const toolKeys = { v: 'select', b: 'tile', w: 'wall', d: 'door', n: 'note', f: 'fog', p: 'draw' };
    const tool = toolKeys[e.key.toLowerCase()];
    if (tool) { mcSetTool(tool); e.preventDefault(); }
}

function _mcOnKeyUp(e) {
    if (e.code === 'Space') _mc.spaceDown = false;
    _mc.shiftDown = e.shiftKey;
}

// ─── Utilidades ─────────────────────────────────────────────────────────────

function _mcUUID() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function _escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
