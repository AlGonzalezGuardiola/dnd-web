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
        tiles:      null,  // PIXI.Container
        walls:      null,  // PIXI.Graphics
        doors:      null,  // PIXI.Container
        notes:      null,  // PIXI.Container
        fog:        null,  // PIXI.Graphics
        ui:         null,  // PIXI.Graphics (selection handles)
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
    isPanning:   false,
    panStart:    { x: 0, y: 0 },
    panStartPos: { x: 0, y: 0 },
    panelTab:    'scene',
    fogBrushSize: 70,
    tileToPlace:  null,  // Tile a colocar desde la paleta
    wallDrawing:  null,  // Muro en progreso { x1,y1,x2,y2 }
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
        version:    1,
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
    // Si ya estaba inicializado y queremos mapa nuevo, resetear explícitamente
    if (_mc.initialized && !mapId) _mcNewScene();
    setView('mapCreator');  // llama initMapCreator()
    if (mapId) {
        // Dar un tick para que el DOM esté listo antes de cargar
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

    grid.innerHTML = '<div class="mc-hub-loading">🔄 Cargando mapas…</div>';

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
        showNotification('🗑 Mapa eliminado', 1800);
        _mcRenderHubGrid();
    } catch (err) {
        showNotification('❌ ' + err.message, 3000);
    }
}

// ─── Editor: init PixiJS ───────────────────────────────────────────────────

function initMapCreator() {
    const wrap = document.getElementById('mcCanvasWrap');
    if (!wrap) return;

    if (typeof PIXI === 'undefined') {
        wrap.innerHTML = `<div style="color:#f87171;padding:32px;text-align:center">
            ⚠️ El motor gráfico (PixiJS) no se ha cargado.<br>
            Verifica tu conexión a internet y recarga la página.</div>`;
        return;
    }

    if (!_mc.initialized) {
        _mcBootPixi(wrap);
        _mc.initialized = true;
        // _mcBootPixi llama a _mcNewScene — escena nueva lista
    } else {
        // Reactivar renderer al volver a la vista (no reseteamos la escena)
        if (_mc.app) _mc.app.ticker.start();
        _mcResizeCanvas();
        _mcRenderAll();
        _mcUpdateUI();
    }
}

function _mcBootPixi(wrap) {
    // resizeTo hace que PixiJS ajuste automáticamente el canvas al tamaño del contenedor
    _mc.app = new PIXI.Application({
        resizeTo:    wrap,
        backgroundColor: 0x111118,
        resolution:  window.devicePixelRatio || 1,
        autoDensity: true,
        antialias:   true,
    });

    wrap.appendChild(_mc.app.view);

    // Capas en orden
    _mc.stage.world      = new PIXI.Container();
    _mc.stage.background = new PIXI.Container();
    _mc.stage.grid       = new PIXI.Graphics();
    _mc.stage.tiles      = new PIXI.Container();
    _mc.stage.walls      = new PIXI.Graphics();
    _mc.stage.doors      = new PIXI.Container();
    _mc.stage.notes      = new PIXI.Container();
    _mc.stage.fog        = new PIXI.Graphics();
    _mc.stage.ui         = new PIXI.Graphics();

    _mc.app.stage.addChild(_mc.stage.world);
    _mc.stage.world.addChild(_mc.stage.background);
    _mc.stage.world.addChild(_mc.stage.grid);
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
    _mc.app.view.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('keydown', _mcOnKeyDown);
    document.addEventListener('keyup',   _mcOnKeyUp);

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
    _mc.tileToPlace  = null;
    _mc.dragState    = null;

    _mcPushHistory(); // snapshot inicial
    _mcApplyViewport();
    _mcRenderAll();
    _mcSyncTopbar();
    _mcUpdateToolbar();
    _mcSyncStatusBar();
    _mcResizeCanvas();
}

// ─── Canvas resize ─────────────────────────────────────────────────────────

function _mcResizeCanvas() {
    // Con resizeTo, PixiJS gestiona el resize automáticamente.
    // Solo forzamos resize manual si el ticker estaba detenido.
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
        // Imagen no configurada: fondo neutro
        const g = new PIXI.Graphics();
        g.beginFill(0x1a1a2e, 1);
        g.drawRect(0, 0, width, height);
        g.endFill();
        c.addChild(g);
    }

    // Borde del canvas del mapa
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

function _mcRenderTiles() {
    const c = _mc.stage.tiles;
    c.removeChildren().forEach(ch => ch.destroy({ children: true }));

    for (const tile of _mc.scene.tiles) {
        const texture = _mcGetTexture(tile.url);
        const sprite  = new PIXI.Sprite(texture);
        sprite.x        = tile.x;
        sprite.y        = tile.y;
        sprite.width    = tile.width;
        sprite.height   = tile.height;
        sprite.rotation = tile.rotation || 0;
        sprite.alpha    = tile.alpha !== undefined ? tile.alpha : 1;
        sprite.anchor.set(0, 0);
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

    // Muro en construcción
    if (_mc.wallDrawing) {
        g.lineStyle(2, 0xef4444, 0.55);
        g.moveTo(_mc.wallDrawing.x1, _mc.wallDrawing.y1);
        g.lineTo(_mc.wallDrawing.x2, _mc.wallDrawing.y2);
    }
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

function _mcRenderUI() {
    const g = _mc.stage.ui;
    g.clear();
    if (!_mc.selection || _mc.selection.type !== 'tile') return;

    const tile = _mc.scene.tiles.find(t => t.id === _mc.selection.id);
    if (!tile) return;

    // Bounding box
    g.lineStyle(1.5, 0xffd700, 1);
    g.beginFill(0, 0);
    g.drawRect(tile.x, tile.y, tile.width, tile.height);
    g.endFill();

    // 8 handles
    const hx = [tile.x, tile.x + tile.width / 2, tile.x + tile.width];
    const hy = [tile.y, tile.y + tile.height / 2, tile.y + tile.height];
    g.lineStyle(1, 0x000000, 0.5);
    g.beginFill(0xffffff, 1);
    for (const x of hx) {
        for (const y of hy) {
            if (x === tile.x + tile.width / 2 && y === tile.y + tile.height / 2) continue;
            g.drawRect(x - 4, y - 4, 8, 8);
        }
    }
    g.endFill();
}

// ─── Texture cache ─────────────────────────────────────────────────────────

function _mcGetTexture(url) {
    if (_mc.textureCache.has(url)) return _mc.textureCache.get(url);

    let texture;
    if (url && url.startsWith('color:')) {
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
    for (const [, tex] of _mc.textureCache) {
        if (tex && !tex.destroyed && tex !== PIXI.Texture.WHITE) tex.destroy();
    }
    _mc.textureCache.clear();
}

// ─── Hit testing (sin PixiJS events) ──────────────────────────────────────

function _mcHitTest(wx, wy) {
    // Tiles — de arriba a abajo (el último añadido está encima)
    for (let i = _mc.scene.tiles.length - 1; i >= 0; i--) {
        const t = _mc.scene.tiles[i];
        if (wx >= t.x && wx <= t.x + t.width && wy >= t.y && wy <= t.y + t.height) {
            return { type: 'tile', id: t.id };
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

function _mcDistToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
}

function _mcGetObject(type, id) {
    if (type === 'tile')  return _mc.scene.tiles.find(t => t.id === id);
    if (type === 'wall')  return _mc.scene.walls.find(w => w.id === id);
    if (type === 'door')  return _mc.scene.doors.find(d => d.id === id);
    if (type === 'note')  return _mc.scene.notes.find(n => n.id === id);
    return null;
}

// ─── Selection ─────────────────────────────────────────────────────────────

function _mcSelectObject(type, id) {
    _mc.selection = { type, id };
    _mcRenderWalls();
    _mcRenderDoors();
    _mcRenderNotes();
    _mcRenderUI();
    // Ir al tab de propiedades
    if (_mc.panelTab !== 'props') mcPanelTab('props');
    else _mcUpdatePropertiesPanel();
}

function _mcDeselect() {
    if (!_mc.selection) return;
    _mc.selection = null;
    _mcRenderWalls();
    _mcRenderDoors();
    _mcRenderNotes();
    _mcRenderUI();
    _mcUpdatePropertiesPanel();
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
    _mcRenderAll();
    _mcUpdateUI();
}

function mcRedo() {
    if (_mc.historyIndex >= _mc.history.length - 1) return;
    _mc.historyIndex++;
    _mc.scene     = JSON.parse(_mc.history[_mc.historyIndex]);
    _mc.selection = null;
    _mcRenderAll();
    _mcUpdateUI();
}

function _mcUpdateModifiedDot() {
    const el = document.getElementById('mcModifiedDot');
    if (el) el.style.display = _mc.modified ? 'inline-block' : 'none';
}

// ─── Herramienta activa ─────────────────────────────────────────────────────

function mcSetTool(tool) {
    _mc.tool        = tool;
    _mc.wallDrawing = null;
    _mc.tileToPlace = _mc.tileToPlace; // preservar si cambiamos a 'tile'
    if (tool !== 'tile') _mc.tileToPlace = null;
    _mcDeselect();
    _mcUpdateToolbar();
    _mcRenderWalls();
}

function _mcUpdateToolbar() {
    document.querySelectorAll('.mc-tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === _mc.tool);
    });
}

// ─── Delete ────────────────────────────────────────────────────────────────

function mcDeleteSelected() {
    if (!_mc.selection) return;
    const { type, id } = _mc.selection;
    _mcPushHistory();

    if (type === 'tile')  _mc.scene.tiles = _mc.scene.tiles.filter(t => t.id !== id);
    if (type === 'wall')  _mc.scene.walls = _mc.scene.walls.filter(w => w.id !== id);
    if (type === 'door')  _mc.scene.doors = _mc.scene.doors.filter(d => d.id !== id);
    if (type === 'note')  _mc.scene.notes = _mc.scene.notes.filter(n => n.id !== id);

    _mc.selection = null;
    _mcRenderAll();
    _mcUpdatePropertiesPanel();
}

// ─── Guardado ──────────────────────────────────────────────────────────────

async function mcSave() {
    const btn = document.getElementById('mcSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = '💾 Guardando…'; }

    try {
        const name         = _mc.scene.name || 'Mapa sin nombre';
        const thumbnailUrl = await _mcExportThumbnail();

        if (_mc.mapId) {
            // Actualizar existente
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
            // Crear nuevo
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
        showNotification('✅ Mapa guardado', 2000);
    } catch (err) {
        showNotification('❌ ' + err.message, 3000);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; }
    }
}

// Auto-save 3 s después del último cambio (solo si hay mapId)
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
            showNotification('⚠️ Este mapa no tiene datos de escena editables', 3000);
            return;
        }

        _mc.scene        = data.sceneData;
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
        showNotification('❌ ' + err.message, 3000);
    }
}

// ─── Descarga ──────────────────────────────────────────────────────────────

async function mcDownload() {
    const name = (_mc.scene.name || 'mapa').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');

    // 1. Imagen PNG del mapa completo
    try {
        const dataUrl = await _mcExportFullRender();
        const a = document.createElement('a');
        a.download = `${name}.png`;
        a.href     = dataUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (err) {
        showNotification('⚠️ No se pudo exportar la imagen: ' + err.message, 3000);
    }

    // 2. JSON de escena editable
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

    // Guardar viewport
    const sv = { x: _mc.stage.world.x, y: _mc.stage.world.y,
                  sx: _mc.stage.world.scale.x, sy: _mc.stage.world.scale.y };

    // Resetear a espacio mundo 1:1
    _mc.stage.world.position.set(0, 0);
    _mc.stage.world.scale.set(1, 1);

    // RenderTexture al tamaño de la escena
    const rt = PIXI.RenderTexture.create({ width, height });
    _mc.app.renderer.render(_mc.stage.world, { renderTexture: rt });

    // Extraer canvas
    const srcCanvas = _mc.app.renderer.extract.canvas(rt);
    rt.destroy();

    // Restaurar viewport
    _mc.stage.world.position.set(sv.x, sv.y);
    _mc.stage.world.scale.set(sv.sx, sv.sy);

    // Escalar si hace falta
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
    if (_mc.panelTab === 'scene') _mcUpdateScenePanel();
    else if (_mc.panelTab === 'props') _mcUpdatePropertiesPanel();
    else if (_mc.panelTab === 'tiles') _mcUpdateTilesPanel();
}

// ─── Eventos de ratón / teclado ────────────────────────────────────────────

function _mcOnWheel(e) {
    e.preventDefault();
    _mcZoomAt(e.offsetX, e.offsetY, e.deltaY);
}

function _mcOnMouseDown(e) {
    const rect = _mc.app.view.getBoundingClientRect();
    const sx   = e.clientX - rect.left;
    const sy   = e.clientY - rect.top;

    // Botón medio o Space+clic = pan
    if (e.button === 1 || (e.button === 0 && _mc.spaceDown)) {
        _mc.isPanning    = true;
        _mc.panStart     = { x: e.clientX, y: e.clientY };
        _mc.panStartPos  = { x: _mc.pan.x, y: _mc.pan.y };
        return;
    }
    if (e.button !== 0) return;

    const wp = _mcScreenToWorld(sx, sy);
    _mcToolDown(wp.x, wp.y);
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
}

function _mcOnMouseUp(e) {
    if (_mc.isPanning) { _mc.isPanning = false; return; }
    if (e.button !== 0) return;
    const rect = _mc.app.view.getBoundingClientRect();
    const wp   = _mcScreenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    _mcToolUp(wp.x, wp.y);
}

function _mcOnMouseLeave() {
    if (_mc.isPanning) _mc.isPanning = false;
    if (_mc.fogPainting) { _mc.fogPainting = false; _mcPushHistory(); }
}

function _mcOnKeyDown(e) {
    if (state.currentView !== 'mapCreator') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.code === 'Space') { _mc.spaceDown = true; e.preventDefault(); return; }
    if (e.key === 'Escape') { _mcDeselect(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { mcDeleteSelected(); e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { mcUndo(); e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        mcRedo(); e.preventDefault(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { mcSave(); e.preventDefault(); return; }

    const toolKeys = { v: 'select', b: 'tile', w: 'wall', d: 'door', n: 'note', f: 'fog' };
    const tool = toolKeys[e.key.toLowerCase()];
    if (tool) { mcSetTool(tool); e.preventDefault(); }
}

function _mcOnKeyUp(e) {
    if (e.code === 'Space') _mc.spaceDown = false;
}

// ─── Utilidades ─────────────────────────────────────────────────────────────

function _mcUUID() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function _escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
